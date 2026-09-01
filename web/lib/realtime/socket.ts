import { io, type Socket } from 'socket.io-client';

export type SqSocket = {
  on: (event: string, handler: (payload: unknown) => void) => () => void;
  onReady: (handler: (payload: unknown) => void) => () => void;
  send: (event: string, payload: unknown) => void;
  close: () => void;
};

// Токен берётся у BFF на каждое подключение: в браузере он нигде не
// хранится, а cookie скриптам недоступны.
async function realtimeToken(): Promise<string> {
  const response = await fetch('/api/realtime/token');
  if (!response.ok) throw new Error('Нет сессии: подключение к реальному времени невозможно');

  const { token } = (await response.json()) as { token: string };
  return token;
}

export async function connectRealtime(): Promise<SqSocket> {
  const token = await realtimeToken();

  // Неймспейс '/ws' — как у шлюза. Не путь socket.io: там свой дефолт
  // '/socket.io', и прокси стенда проксирует именно его.
  const socket: Socket = io('/ws', {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  const subscribe = (event: string, handler: (payload: unknown) => void) => {
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  };

  return {
    on: subscribe,
    // Комнаты назначаются асинхронно уже после 'connect', поэтому шлюз
    // отдельно шлёт 'ready'. Кому важно не пропустить событие — ждёт его.
    onReady: (handler) => subscribe('ready', handler),
    send: (event, payload) => socket.emit(event, payload),
    close: () => socket.disconnect(),
  };
}
