'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/generated';
import { connectRealtime, type SqSocket } from '@/lib/realtime/socket';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type Message = components['schemas']['MessageDto'];

type PendingMessage = {
  attemptId: number;
  text: string;
  baselineIds: Set<string>;
  observed: boolean;
};

const ACK_TIMEOUT_MS = 5_000;

type DeliveryStatus =
  'idle' | 'pending' | 'checking' | 'unknown' | 'observed' | 'failed';
type ConnectionStatus = 'connecting' | 'recovering' | 'ready' | 'offline';
type HistoryStatus = 'loading' | 'ready' | 'error';

export default function Chat({
  consultationId,
  readOnly = false,
  senderRole = 'client',
  locale = 'ru',
}: {
  consultationId: string;
  readOnly?: boolean;
  senderRole?: Message['senderRole'];
  locale?: string;
}) {
  const copy = locale === 'kz' ? kz.chat : ru.chat;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('idle');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    readOnly ? 'ready' : 'connecting',
  );
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>('loading');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const socketRef = useRef<SqSocket | null>(null);
  const transportReadyRef = useRef(false);
  const socketReadyRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const pendingRef = useRef<PendingMessage | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const resyncRef = useRef<(() => Promise<Message[]>) | null>(null);
  const conversationKeyRef = useRef<string | null>(null);
  const conversationKey = `${consultationId}:${senderRole}:${readOnly ? 'read' : 'live'}:${locale}`;

  const markReadyAfterHistory = useCallback(() => {
    if (!mountedRef.current || !transportReadyRef.current) return;
    socketReadyRef.current = true;
    setConnectionStatus('ready');
  }, []);

  const retryHistory = useCallback(() => {
    setHistoryStatus('loading');
    void resyncRef
      .current?.()
      .then(markReadyAfterHistory)
      .catch(() => undefined);
  }, [markReadyAfterHistory]);

  const observePending = useCallback(
    (message: Message) => {
      const pending = pendingRef.current;
      if (
        !pending ||
        message.consultationId !== consultationId ||
        message.senderRole !== senderRole ||
        message.text !== pending.text ||
        pending.baselineIds.has(message.id)
      ) {
        return false;
      }

      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
      pending.observed = true;
      setError(copy.deliveryObserved);
      setDeliveryStatus('observed');
      return true;
    },
    [consultationId, copy.deliveryObserved, senderRole],
  );

  const clearObservedDraft = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setError(null);
    setDeliveryStatus('idle');
    setDraft((current) => (current.trim() === pending.text ? '' : current));
  }, []);

  const reconcilePending = useCallback(
    async (attemptId: number) => {
      setDeliveryStatus('checking');
      const fetched = await resyncRef.current?.().catch(() => []);
      if (!mountedRef.current) return;
      const pending = pendingRef.current;
      if (!pending || pending.attemptId !== attemptId) return;
      if (fetched?.some((message) => observePending(message))) return;
      setDeliveryStatus('unknown');
      setError(copy.deliveryUnknown);
    },
    [copy.deliveryUnknown, observePending],
  );

  // Добавление через Map по id: одно и то же сообщение приходит и
  // историей, и сокетом — например, когда история догрузилась позже
  // события. Проверка по id дешевле любой эвристики по тексту.
  const add = useCallback((incoming: Message[]) => {
    setMessages((current) => {
      const byId = new Map(current.map((m) => [m.id, m]));
      for (const message of incoming) byId.set(message.id, message);
      const merged = [...byId.values()].sort((a, b) => {
        const byCreatedAt = a.createdAt.localeCompare(b.createdAt);
        return byCreatedAt || a.id.localeCompare(b.id);
      });
      messagesRef.current = merged;
      return merged;
    });
  }, []);

  useEffect(() => {
    let dropped = false;
    let historyInFlight: Promise<Message[]> | null = null;
    let historyQueued = false;
    const abort = new AbortController();
    mountedRef.current = true;
    const newConversation = conversationKeyRef.current !== conversationKey;
    conversationKeyRef.current = conversationKey;
    if (newConversation) {
      messagesRef.current = [];
      pendingRef.current = null;
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
      setMessages([]);
      setDraft('');
      setError(null);
      setDeliveryStatus('idle');
    }
    setHistoryStatus('loading');
    setConnectionStatus(readOnly ? 'ready' : 'connecting');

    const loadHistory = async (): Promise<Message[]> => {
      let cursor: string | null = null;
      const seenCursors = new Set<string>();
      const fetched: Message[] = [];

      // Сервер отдаёт историю от старых к новым. Идём по cursor до конца,
      // чтобы reconnect-resync действительно увидел последнее сообщение.
      for (let page = 0; page < 100; page += 1) {
        const suffix: string = cursor
          ? `&cursor=${encodeURIComponent(cursor)}`
          : '';
        const history: {
          items: Message[];
          nextCursor?: string | null;
        } | null = await apiFetch<{
          items: Message[];
          nextCursor?: string | null;
        }>(`consultations/${consultationId}/messages?limit=100${suffix}`, {
          signal: abort.signal,
        });
        if (!history) throw new Error('Пустой ответ истории чата');
        fetched.push(...history.items);
        if (!dropped) add(history.items);

        if (!history.nextCursor) return fetched;
        if (seenCursors.has(history.nextCursor)) {
          throw new Error('Повторяющийся cursor истории чата');
        }
        seenCursors.add(history.nextCursor);
        cursor = history.nextCursor;
      }

      throw new Error('История чата превысила лимит ресинка');
    };

    const syncHistory = (queueIfBusy = false): Promise<Message[]> => {
      if (historyInFlight) {
        if (queueIfBusy) historyQueued = true;
        return historyInFlight;
      }

      const run = async () => {
        let fetched: Message[] = [];
        try {
          do {
            historyQueued = false;
            fetched = await loadHistory();
          } while (!dropped && historyQueued);
          if (!dropped) setHistoryStatus('ready');
          return fetched;
        } catch (caught) {
          if (!dropped && !abort.signal.aborted) setHistoryStatus('error');
          throw caught;
        }
      };

      const request = run().finally(() => {
        if (historyInFlight === request) historyInFlight = null;
      });
      historyInFlight = request;
      return request;
    };
    resyncRef.current = () => syncHistory(true);

    void syncHistory().catch(() => undefined);

    if (!readOnly) {
      void (async () => {
        try {
          const socket = await connectRealtime();
          if (dropped) {
            socket.close();
            return;
          }
          socketRef.current = socket;
          socketReadyRef.current = false;
          transportReadyRef.current = false;

          socket.onReady(() => {
            if (dropped) return;
            transportReadyRef.current = true;
            socketReadyRef.current = false;
            setConnectionStatus('recovering');
            void syncHistory(true)
              .then((fetched) => {
                markReadyAfterHistory();
                fetched.some((message) => observePending(message));
              })
              .catch(() => {
                if (!dropped) setConnectionStatus('offline');
              });
          });
          socket.on('disconnect', () => {
            if (dropped) return;
            transportReadyRef.current = false;
            socketReadyRef.current = false;
            setConnectionStatus('offline');
            const pending = pendingRef.current;
            if (pending) void reconcilePending(pending.attemptId);
          });
          socket.on('connect_error', () => {
            if (dropped) return;
            transportReadyRef.current = false;
            socketReadyRef.current = false;
            setConnectionStatus('offline');
            const pending = pendingRef.current;
            if (pending) void reconcilePending(pending.attemptId);
          });

          socket.on('chat.message', (payload) => {
            if (dropped) return;
            const message = payload as Message;
            // Комната адресована пользователю: у него может идти не одна
            // консультация, чужие сообщения сюда попадать не должны.
            if (message.consultationId === consultationId) {
              add([message]);
              observePending(message);
            }
          });
          socket.on('chat.error', (payload) => {
            if (dropped) return;
            const pending = pendingRef.current;
            if (!pending) return;
            if (pending.observed) return;
            pendingRef.current = null;
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
            pendingTimerRef.current = null;
            const code = (payload as { code?: string }).code;
            const errors: Record<string, string> = {
              CONSULTATION_NOT_ACTIVE: copy.inactive,
              VALIDATION_FAILED: copy.tooLong,
              MESSAGE_TOO_LONG: copy.tooLong,
              CHAT_RATE_LIMITED: copy.rateLimited,
            };
            setDeliveryStatus('failed');
            setError((code && errors[code]) || copy.sendFailed);
          });
        } catch {
          if (!dropped) setConnectionStatus('offline');
        }
      })();
    }

    return () => {
      dropped = true;
      mountedRef.current = false;
      abort.abort();
      resyncRef.current = null;
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
      transportReadyRef.current = false;
      socketReadyRef.current = false;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [
    add,
    consultationId,
    conversationKey,
    copy,
    markReadyAfterHistory,
    observePending,
    readOnly,
    reconnectNonce,
    reconcilePending,
    senderRole,
  ]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (pendingRef.current) {
      setDeliveryStatus('unknown');
      setError(copy.deliveryUnknown);
      return;
    }

    setError(null);
    if (!socketRef.current || !socketReadyRef.current) {
      pendingRef.current = null;
      setDeliveryStatus('failed');
      setError(copy.notSent);
      return;
    }
    const pending: PendingMessage = {
      attemptId: ++attemptRef.current,
      text,
      baselineIds: new Set(messagesRef.current.map((message) => message.id)),
      observed: false,
    };
    pendingRef.current = pending;
    const sent = socketRef.current.send('chat.send', { consultationId, text });
    if (!sent) {
      pendingRef.current = null;
      socketReadyRef.current = false;
      setDeliveryStatus('failed');
      setError(copy.notSent);
      return;
    }
    setDeliveryStatus('pending');
    if (pendingRef.current?.attemptId === pending.attemptId) {
      pendingTimerRef.current = setTimeout(() => {
        void reconcilePending(pending.attemptId);
      }, ACK_TIMEOUT_MS);
    }
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <ul
        role="log"
        aria-live="polite"
        aria-label={copy.logLabel}
        className="flex flex-1 flex-col gap-2 overflow-y-auto p-1"
      >
        {messages.map((message) => (
          <li
            key={message.id}
            className={
              message.senderRole === senderRole
                ? 'max-w-[80%] self-end rounded-2xl bg-primary px-4 py-2 text-sm text-white'
                : 'max-w-[80%] self-start rounded-2xl bg-chip px-4 py-2 text-sm text-ink'
            }
          >
            {message.text}
          </li>
        ))}
      </ul>

      {historyStatus === 'loading' && messages.length === 0 ? (
        <p role="status" className="px-1 py-2 text-sm text-muted">
          {copy.historyLoading}
        </p>
      ) : null}
      {historyStatus === 'error' ? (
        <div
          role="alert"
          className="mx-1 my-2 rounded-2xl bg-chip p-4 text-sm text-body"
        >
          <p>{copy.historyError}</p>
          <button
            type="button"
            onClick={retryHistory}
            className="mt-3 min-h-11 rounded-xl bg-primary px-4 py-2 font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {copy.retryHistory}
          </button>
        </div>
      ) : null}

      {!readOnly && connectionStatus === 'offline' ? (
        <div
          role="alert"
          className="mx-1 my-2 rounded-2xl bg-chip p-4 text-sm text-body"
        >
          <p>{copy.offline}</p>
          <button
            type="button"
            onClick={() => setReconnectNonce((current) => current + 1)}
            className="mt-3 min-h-11 rounded-xl bg-primary px-4 py-2 font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {copy.retryConnection}
          </button>
        </div>
      ) : !readOnly && connectionStatus !== 'ready' ? (
        <p role="status" className="px-1 py-2 text-sm font-semibold text-body">
          {copy.connecting}
        </p>
      ) : null}

      {error && (
        <p
          role="alert"
          className="px-1 py-2 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      )}

      {deliveryStatus === 'unknown' || deliveryStatus === 'checking' ? (
        <button
          type="button"
          disabled={deliveryStatus === 'checking'}
          onClick={() => {
            const pending = pendingRef.current;
            if (pending) void reconcilePending(pending.attemptId);
          }}
          className="mx-1 min-h-11 self-start rounded-xl bg-chip px-4 py-2 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {deliveryStatus === 'checking'
            ? copy.checkingDelivery
            : copy.checkDelivery}
        </button>
      ) : null}

      {deliveryStatus === 'observed' ? (
        <button
          type="button"
          onClick={clearObservedDraft}
          className="mx-1 min-h-11 self-start rounded-xl bg-chip px-4 py-2 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {copy.clearObserved}
        </button>
      ) : null}

      {!readOnly ? (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <label htmlFor="chat-draft" className="sr-only">
            {copy.messageLabel}
          </label>
          <input
            id="chat-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={copy.placeholder}
            className="h-12 flex-1 rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={
              deliveryStatus === 'pending' ||
              deliveryStatus === 'checking' ||
              deliveryStatus === 'unknown' ||
              deliveryStatus === 'observed'
            }
            className="h-12 rounded-2xl bg-primary px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {deliveryStatus === 'pending' ? copy.sending : copy.send}
          </button>
        </form>
      ) : null}
    </div>
  );
}
