import { EventEmitter } from 'node:events';
import { changeSession } from '@/lib/auth/browser-session';
import { connectRealtime, type SqSocket } from './socket';

class FakeSocket extends EventEmitter {
  connected = false;
  disconnect = jest.fn();
  emitted: { event: string; payload: unknown }[] = [];
  emit(event: string, ...args: unknown[]): boolean {
    // Исходящие складываем, входящие раздаём слушателям как обычно.
    if (event.startsWith('chat.') || event === 'ready') {
      this.emitted.push({ event, payload: args[0] });
    }
    return super.emit(event, ...args);
  }
}

const fake = new FakeSocket();
const io = jest.fn((..._args: unknown[]) => fake);
jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => io(...args),
}));

const originalFetch = global.fetch;
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, work: () => unknown) => work() } });
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
  fake.removeAllListeners();
  fake.emitted = [];
});

function tokenResponds(status: number, payload: unknown) {
  global.fetch = jest.fn(async (path: string) => path === '/api/auth/session'
    ? { ok: true, status: 200, json: async () => ({ user: { id: 'u1' }, expiresAt: Date.now() + 120_000 }) }
    : { ok: status >= 200 && status < 300, status, json: async () => payload }) as unknown as typeof fetch;
}

describe('connectRealtime', () => {
  it('берёт токен у BFF, а не из хранилища браузера', async () => {
    tokenResponds(200, { token: 'access-value' });

    await connectRealtime();

    expect((global.fetch as jest.Mock).mock.calls.map(([path]) => path)).toEqual(['/api/auth/session', '/api/realtime/token']);
  });

  it('передаёт токен в рукопожатии, как ждёт шлюз', async () => {
    tokenResponds(200, { token: 'access-value' });

    await connectRealtime();

    const options = io.mock.calls[0][1] as unknown as {
      auth: (done: (credentials: { token: string }) => void) => void;
    };
    const done = jest.fn();
    options.auth(done);
    expect(done).toHaveBeenCalledWith({ token: 'access-value' });
  });

  it('подключается к неймспейсу /ws, а не к корню', async () => {
    tokenResponds(200, { token: 'access-value' });

    await connectRealtime();

    expect(String(io.mock.calls[0][0] as unknown)).toContain('/ws');
  });

  it('без сессии не подключается и говорит об этом', async () => {
    tokenResponds(401, { code: 'UNAUTHORIZED' });

    await expect(connectRealtime()).rejects.toThrow(/сесси/i);
    expect(io).not.toHaveBeenCalled();
  });

  it('ждёт события ready: до него адресные события уходят в пустоту', async () => {
    tokenResponds(200, { token: 'access-value' });

    const socket = await connectRealtime();
    const seen: unknown[] = [];
    socket.onReady((data) => seen.push(data));
    fake.emit('ready', { expertId: null });

    expect(seen).toEqual([{ expertId: null }]);
  });

  it('не теряет быстрый ready, пришедший до регистрации React handler', async () => {
    tokenResponds(200, { token: 'access-value' });
    const socket = await connectRealtime();
    fake.emit('ready', { expertId: 'e1' });
    const seen: unknown[] = [];

    socket.onReady((data) => seen.push(data));
    await Promise.resolve();

    expect(seen).toEqual([{ expertId: 'e1' }]);
  });

  it('не буферизует chat.send до ready и сообщает вызывающему, что emit не состоялся', async () => {
    tokenResponds(200, { token: 'access-value' });
    const socket = await connectRealtime();

    expect(
      socket.send('chat.send', { consultationId: 'c1', text: 'draft' }),
    ).toBe(false);
    expect(fake.emitted).toEqual([]);

    fake.emit('ready', { expertId: null });
    expect(
      socket.send('chat.send', { consultationId: 'c1', text: 'draft' }),
    ).toBe(true);
    expect(fake.emitted).toContainEqual({
      event: 'chat.send',
      payload: { consultationId: 'c1', text: 'draft' },
    });
  });

  it('после disconnect снова запрещает send до нового ready', async () => {
    tokenResponds(200, { token: 'access-value' });
    const socket = await connectRealtime();
    fake.emit('ready', { expertId: null });
    fake.emit('disconnect', 'transport close');

    expect(
      socket.send('chat.send', { consultationId: 'c1', text: 'draft' }),
    ).toBe(false);
  });

  it('отписка снимает слушателя и закрывает сокет', async () => {
    tokenResponds(200, { token: 'access-value' });

    const socket: SqSocket = await connectRealtime();
    socket.close();

    expect(fake.disconnect).toHaveBeenCalled();
  });
});

 it('obtains a fresh realtime token on reconnect', async () => {
  tokenResponds(200, { token: 'first-token' });
  const socket = await connectRealtime();
  const options = io.mock.calls[0][1] as unknown as { auth: (done: (credentials: { token: string }) => void) => void };
  options.auth(jest.fn());
  tokenResponds(200, { token: 'renewed-token' });
  const credentials = await new Promise((resolve) => options.auth(resolve));
  expect(credentials).toEqual({ token: 'renewed-token' });
  socket.close();
});
it('disconnects on an account change and cannot send queued chat as the next account', async () => {
  tokenResponds(200, { token: 'token-a' });
  const socket = await connectRealtime();
  fake.emit('ready', {});
  await changeSession('/api/auth/logout', { method: 'POST' });
  expect(fake.disconnect).toHaveBeenCalled();
  expect(socket.send('chat.send', { text: 'old message' })).toBe(false);
  socket.close();
});
