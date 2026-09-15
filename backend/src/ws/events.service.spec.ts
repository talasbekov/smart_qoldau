import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { AccountAccessService } from '../auth/account-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

// DB and transport doubles expose ordering at the service boundary. Resolving
// later checks first must never revive an offer after its revocation.
describe('EventsService room FIFO', () => {
  let service: EventsService;
  let access: { assertActive: jest.Mock };
  let deliveries: string[];
  let disconnects: string[];
  let emit: jest.Mock;

  beforeEach(() => {
    deliveries = [];
    disconnects = [];
    access = { assertActive: jest.fn().mockResolvedValue(undefined) };
    emit = jest.fn((room: string, event: string) => {
      deliveries.push(`${room}/${event}`);
    });
    const server = {
      to: (room: string) => ({ emit: (event: string) => emit(room, event) }),
      local: {
        in: (rooms: string[]) => ({
          disconnectSockets: () => disconnects.push(`local:${rooms.join(',')}`),
        }),
      },
      in: (rooms: string[]) => ({
        disconnectSockets: () => disconnects.push(`cluster:${rooms.join(',')}`),
      }),
    };
    service = new EventsService(
      access as unknown as AccountAccessService,
      {
        expert: { findUnique: async () => ({ userId: 'owner' }) },
      } as unknown as PrismaService,
    );
    service.setServer(server as unknown as Server);
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['user', 'expert'] as const)(
    '%s room preserves new -> revoked when the first check is delayed',
    async (kind) => {
      const first = deferred();
      access.assertActive.mockReturnValueOnce(first.promise);
      const send = (event: string) =>
        kind === 'user'
          ? service.emitToUser('recipient', event, {})
          : service.emitToExpert('recipient', event, {});
      expect(send('offer.new')).toBeUndefined();
      expect(send('offer.revoked')).toBeUndefined();
      await turn();
      const beforeRelease = [...deliveries];
      first.resolve();
      await turn();
      expect(beforeRelease).toEqual([]);
      expect(deliveries).toEqual([
        `${kind}:recipient/offer.new`,
        `${kind}:recipient/offer.revoked`,
      ]);
    },
  );

  it('does not block an unrelated room behind a delayed check', async () => {
    const first = deferred();
    access.assertActive.mockReturnValueOnce(first.promise);
    service.emitToUser('slow', 'offer.new', {});
    service.emitToUser('fast', 'offer.new', {});
    await turn();
    const beforeRelease = [...deliveries];
    first.resolve();
    await turn();
    expect(beforeRelease).toEqual(['user:fast/offer.new']);
    expect(deliveries).toEqual(['user:fast/offer.new', 'user:slow/offer.new']);
  });

  it('drops a rejected first check, disconnects and continues the same room', async () => {
    const first = deferred();
    access.assertActive.mockReturnValueOnce(first.promise);
    service.emitToUser('recipient', 'offer.new', {});
    service.emitToUser('recipient', 'offer.revoked', {});
    await turn();
    const beforeRejection = [...deliveries];
    first.reject(new Error('DB unavailable'));
    await turn();
    expect(beforeRejection).toEqual([]);
    expect(deliveries).toEqual(['user:recipient/offer.revoked']);
    expect(disconnects).toEqual([
      'local:user:recipient',
      'cluster:user:recipient',
    ]);
  });

  it('checks queued recipients afresh after a completed block', async () => {
    const first = deferred();
    let blocked = false;
    access.assertActive
      .mockReturnValueOnce(first.promise)
      .mockImplementation(async () => {
        if (blocked) throw new Error('blocked');
      });
    service.emitToUser('recipient', 'offer.new', {});
    service.emitToUser('recipient', 'offer.revoked', {});
    await turn();
    blocked = true;
    first.resolve();
    await turn();
    expect(deliveries).toEqual(['user:recipient/offer.new']);
    expect(disconnects).toEqual([
      'local:user:recipient',
      'cluster:user:recipient',
    ]);
  });

  it('continues the room after a transport exception', async () => {
    emit.mockImplementationOnce(() => {
      throw new Error('transport unavailable');
    });
    service.emitToUser('recipient', 'offer.new', {});
    service.emitToUser('recipient', 'offer.revoked', {});
    await turn();
    expect(deliveries).toEqual(['user:recipient/offer.revoked']);
  });
  it('releases empty queues without deleting a newer pending tail', async () => {
    const first = deferred();
    const second = deferred();
    access.assertActive
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    service.emitToUser('recipient', 'offer.new', {});
    service.emitToUser('recipient', 'offer.revoked', {});
    first.resolve();
    await turn();
    // White-box check of the memory invariant: completed rooms cannot remain
    // retained, and an older completion must not remove a newer pending tail.
    const tails = Reflect.get(service, 'roomTails') as
      Map<string, Promise<void>> | undefined;
    const retained = tails?.has('user:recipient');
    second.resolve();
    await turn();
    expect(retained).toBe(true);
    expect(tails?.size).toBe(0);
    service.emitToUser('recipient', 'offer.new', {});
    await turn();
    expect(deliveries).toEqual([
      'user:recipient/offer.new',
      'user:recipient/offer.revoked',
      'user:recipient/offer.new',
    ]);
    expect(tails?.size).toBe(0);
  });
});
