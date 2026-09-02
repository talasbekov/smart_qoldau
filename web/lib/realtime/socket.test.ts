import { EventEmitter } from 'node:events';
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
jest.mock('socket.io-client', () => ({ io: (...args: unknown[]) => io(...args) }));

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
  fake.removeAllListeners();
  fake.emitted = [];
});

function tokenResponds(status: number, payload: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }) as unknown as typeof fetch;
}

describe('connectRealtime', () => {
  it('берёт токен у BFF, а не из хранилища браузера', async () => {
    tokenResponds(200, { token: 'access-value' });

    await connectRealtime();

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/realtime/token');
  });

  it('передаёт токен в рукопожатии, как ждёт шлюз', async () => {
    tokenResponds(200, { token: 'access-value' });

    await connectRealtime();

    const options = io.mock.calls[0][1] as unknown as { auth: { token: string } };
    expect(options.auth.token).toBe('access-value');
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

  it('отписка снимает слушателя и закрывает сокет', async () => {
    tokenResponds(200, { token: 'access-value' });

    const socket: SqSocket = await connectRealtime();
    socket.close();

    expect(fake.disconnect).toHaveBeenCalled();
  });
});
