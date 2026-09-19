import { sessionFetch, sessionEpoch, documentSessionEpoch, SESSION_CHANGE_EVENT } from '@/lib/auth/browser-session';
import { io, type Socket } from 'socket.io-client';

export type SqSocket = {
  on: (event: string, handler: (payload: unknown) => void) => () => void;
  onReady: (handler: (payload: unknown) => void) => () => void;
  send: (event: string, payload: unknown) => boolean;
  close: () => void;
};

const NOT_READY = Symbol('not-ready');

// Токен берётся у BFF на каждое подключение: в браузере он нигде не
// хранится, а cookie скриптам недоступны.
async function realtimeToken(epoch: string): Promise<string> {
  const response = await sessionFetch('/api/realtime/token', {}, epoch);
  if (!response.ok)
    throw new Error('Нет сессии: подключение к реальному времени невозможно');

  const { token } = (await response.json()) as { token: string };
  return token;
}

export async function connectRealtime(): Promise<SqSocket> {
  const epoch = documentSessionEpoch();
  const token = await realtimeToken(epoch);
  let firstHandshake = true;
  let closed = false;

  // Неймспейс '/ws' — как у шлюза. Не путь socket.io: там свой дефолт
  // '/socket.io', и прокси стенда проксирует именно его.
  const socket: Socket = io('/ws', {
    auth: (done) => {
      if (closed) return;
      if (firstHandshake) {
        firstHandshake = false;
        done({ token });
        return;
      }
      void realtimeToken(epoch).then((fresh) => {
        if (!closed) done({ token: fresh });
      }).catch(() => close());
    },
    transports: ['websocket', 'polling'],
  });
  let readyPayload: unknown | typeof NOT_READY = NOT_READY;
  const readyHandlers = new Set<(payload: unknown) => void>();
  function close() {
    closed = true;
    readyPayload = NOT_READY;
    window.removeEventListener('storage', checkSession);
    window.removeEventListener(SESSION_CHANGE_EVENT, checkSession);
    socket.disconnect();
  }
  function checkSession() {
    try { if (sessionEpoch() !== epoch) close(); }
    catch { close(); }
  }
  window.addEventListener('storage', checkSession);
  window.addEventListener(SESSION_CHANGE_EVENT, checkSession);
  checkSession();


  // Подписываемся до возврата обёртки, чтобы быстрый server ready не
  // потерялся между созданием socket.io и регистрацией React-эффекта.
  socket.on('ready', (payload) => {
    readyPayload = payload;
    for (const handler of readyHandlers) handler(payload);
  });
  socket.on('disconnect', () => {
    readyPayload = NOT_READY;
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
    onReady: (handler) => {
      readyHandlers.add(handler);
      if (readyPayload !== NOT_READY) {
        const current = readyPayload;
        queueMicrotask(() => {
          if (readyHandlers.has(handler) && readyPayload === current)
            handler(current);
        });
      }
      return () => readyHandlers.delete(handler);
    },
    // socket.io буферизует emit во время disconnect. Для чата это опасно:
    // UI не знает, когда действие реально уйдёт. Отказываемся от emit до
    // server ready и возвращаем вызывающему точный локальный результат.
    send: (event, payload) => {
      checkSession();
      if (closed || readyPayload === NOT_READY) return false;
      socket.emit(event, payload);
      return true;
    },
    close,
  };
}
