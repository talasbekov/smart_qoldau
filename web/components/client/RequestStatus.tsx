'use client';

import Link from 'next/link';
import { journeyCopy } from './journey-copy';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import { connectRealtime, type SqSocket } from '@/lib/realtime/socket';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const FALLBACK_DELAYS_MS = [0, 2_000, 5_000] as const;

type SyncStatus = 'connecting' | 'online' | 'recovering' | 'offline';

export type RequestState = {
  id: string;
  topicSlug?: string;
  format?: string;
  isEmergency?: boolean;
  status:
    'SEARCHING' | 'MATCHED' | 'CANCELLED' | 'NO_EXPERTS' | 'CALLBACK_REQUESTED';
  consultationId?: string | null;
  hotlines?: string[] | null;
};

export default function RequestStatus({
  requestId,
  initial,
  locale,
}: {
  requestId: string;
  initial: RequestState;
  locale: string;
}) {
  const router = useRouter();
  const actionCopy = journeyCopy(locale);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const cancelLock = useRef(false);
  const [state, setState] = useState(initial);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [retryNonce, setRetryNonce] = useState(0);
  const copy = locale === 'kz' ? kz.requestStatus : ru.requestStatus;

  useEffect(() => {
    if (state.status !== 'SEARCHING' || !state.topicSlug || !state.format)
      return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    const poll = async () => {
      try {
        const query = new URLSearchParams({
          topicSlug: state.topicSlug!,
          format: state.format!,
          urgentOnly: String(Boolean(state.isEmergency)),
        });
        const result = await apiFetch<{ count: number }>(
          `matching/online-count?${query}`,
          { signal: abort.signal },
        );
        if (!stopped)
          setCount(
            result && Number.isInteger(result.count) && result.count >= 0
              ? result.count
              : null,
          );
      } catch {
        if (!stopped) setCount(null);
      } finally {
        if (!stopped) timer = setTimeout(() => void poll(), 15_000);
      }
    };
    void poll();
    return () => {
      stopped = true;
      abort.abort();
      if (timer) clearTimeout(timer);
    };
  }, [state.status, state.topicSlug, state.format, state.isEmergency]);

  async function cancel() {
    if (cancelLock.current) return;
    cancelLock.current = true;
    setCancelBusy(true);
    setCancelError(false);
    try {
      // After an unknown outcome only GET is allowed until the state is known.
      const fresh = await apiFetch<RequestState>(`requests/${requestId}`);
      if (!fresh) throw new Error('Missing request');
      if (fresh.status !== 'SEARCHING') {
        setState(fresh);
        return;
      }
      const cancelled = await apiFetch<RequestState>(
        `requests/${requestId}/cancel`,
        { method: 'POST' },
      );
      if (!cancelled) throw new Error('Missing cancellation');
      setState(cancelled);
    } catch {
      try {
        const fresh = await apiFetch<RequestState>(`requests/${requestId}`);
        if (fresh) setState(fresh);
        setCancelError(!fresh || fresh.status === 'SEARCHING');
      } catch {
        setCancelError(true);
      }
    } finally {
      cancelLock.current = false;
      setCancelBusy(false);
    }
  }

  const navigation = (
    <div className="mt-5 flex flex-wrap gap-4">
      <Link
        className="min-h-11 rounded-xl bg-primary px-4 py-3 font-bold text-white"
        href={`/${locale}/requests/new`}
      >
        {actionCopy.repeat}
      </Link>
      <Link
        className="min-h-11 px-4 py-3 text-primary underline"
        href={`/${locale}`}
      >
        {actionCopy.home}
      </Link>
    </div>
  );

  useEffect(() => {
    if (state.status !== 'SEARCHING') return;

    let socket: SqSocket | null = null;
    let dropped = false;
    let fallbackActive = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: Promise<RequestState | null> | null = null;
    let resyncQueued = false;
    const abort = new AbortController();

    const resync = (queueIfBusy = false): Promise<RequestState | null> => {
      if (inFlight) {
        if (queueIfBusy) resyncQueued = true;
        return inFlight;
      }

      const run = async () => {
        let fresh: RequestState | null = null;
        do {
          resyncQueued = false;
          setSyncStatus('recovering');
          fresh = await apiFetch<RequestState>(`requests/${requestId}`, {
            signal: abort.signal,
          });
          if (!fresh || fresh.id !== requestId) {
            throw new Error('Некорректный ответ статуса заявки');
          }
          if (!dropped) {
            const next = fresh;
            // MATCHED и прочие финальные состояния необратимы на этом
            // экране: запоздавший SEARCHING из REST не должен отменить
            // более новое событие сокета в том же React batch.
            setState((current) =>
              current.status === 'SEARCHING' ? next : current,
            );
          }
        } while (!dropped && resyncQueued);
        return fresh;
      };

      const request = run().finally(() => {
        if (inFlight === request) inFlight = null;
      });
      inFlight = request;
      return request;
    };

    const stopFallback = () => {
      fallbackActive = false;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
    };

    const startFallback = () => {
      if (fallbackActive || dropped) return;
      fallbackActive = true;

      const poll = (attempt: number) => {
        if (dropped || !fallbackActive) return;
        if (attempt >= FALLBACK_DELAYS_MS.length) {
          fallbackActive = false;
          setSyncStatus('offline');
          return;
        }

        const run = () => {
          retryTimer = null;
          void resync()
            .then((fresh) => {
              if (fresh?.status === 'SEARCHING') poll(attempt + 1);
              else stopFallback();
            })
            .catch(() => poll(attempt + 1));
        };

        const delay = FALLBACK_DELAYS_MS[attempt];
        if (delay === 0) run();
        else retryTimer = setTimeout(run, delay);
      };

      poll(0);
    };

    void (async () => {
      try {
        const connected = await connectRealtime();
        if (dropped) {
          connected.close();
          return;
        }
        socket = connected;
        connected.onReady(() => {
          stopFallback();
          // Если fallback-запрос уже идёт, ставим ещё один за ним: только
          // запрос, начатый после ready, закрывает окно пропущенных событий.
          void resync(true)
            .then(() => {
              if (!dropped) setSyncStatus('online');
            })
            .catch(() => startFallback());
        });
        connected.on('disconnect', startFallback);
        connected.on('connect_error', startFallback);
        connected.on('request.updated', (payload) => {
          if (dropped) return;
          const fresh = payload as RequestState;
          // Комната адресована пользователю, а заявок у него может быть
          // несколько за сессию — чужое событие игнорируем.
          if (fresh.id === requestId) {
            setState((current) =>
              current.status === 'SEARCHING'
                ? { ...current, ...fresh }
                : current,
            );
          }
        });
      } catch {
        // Socket — только ускоритель. При недоступном realtime сразу
        // запускаем ограниченный REST fallback.
        startFallback();
      }
    })();

    return () => {
      dropped = true;
      stopFallback();
      abort.abort();
      socket?.close();
    };
  }, [state.status, requestId, retryNonce]);

  useEffect(() => {
    if (state.status === 'MATCHED' && state.consultationId) {
      router.push(`/${locale}/consultations/${state.consultationId}`);
    }
  }, [state, locale, router]);

  if (state.status === 'CANCELLED') {
    return (
      <div>
        <p className="text-body">{copy.cancelled}</p>
        {navigation}
      </div>
    );
  }

  if (state.status === 'NO_EXPERTS' || state.status === 'CALLBACK_REQUESTED') {
    return (
      <div>
        <h1 className="mb-2 text-xl font-extrabold text-ink">
          {copy.unavailableTitle}
        </h1>
        <p className="mb-4 text-sm text-body">{copy.unavailableBody}</p>
        <ul className="flex flex-wrap gap-3">
          {(state.hotlines ?? ['150', '103', '112']).map((number) => (
            <li key={number}>
              <a
                href={`tel:${number}`}
                className="inline-block rounded-xl bg-chip px-4 py-2 text-sm font-bold text-ink underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {number}
              </a>
            </li>
          ))}
        </ul>
        {navigation}
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-extrabold text-ink">
        {copy.searchingTitle}
      </h1>
      <p className="text-sm text-muted" aria-live="polite">
        {copy.searchingBody}
      </p>
      {count !== null && (
        <p className="mt-3 text-sm" aria-live="polite">
          {actionCopy.online}: {count}
        </p>
      )}
      <button
        type="button"
        disabled={cancelBusy}
        onClick={() => void cancel()}
        className="mt-4 min-h-11 rounded-xl border border-border px-4 font-bold text-primary disabled:opacity-50"
      >
        {cancelBusy ? actionCopy.loading : actionCopy.cancel}
      </button>
      {cancelError && (
        <p role="alert" className="mt-2 text-sm">
          {actionCopy.cancelError}
        </p>
      )}
      {syncStatus === 'recovering' ? (
        <p role="status" className="mt-3 text-sm font-semibold text-body">
          {copy.recovering}
        </p>
      ) : null}
      {syncStatus === 'offline' ? (
        <div
          role="alert"
          className="mt-3 rounded-2xl bg-chip p-4 text-sm text-body"
        >
          <p>{copy.offline}</p>
          <button
            type="button"
            onClick={() => {
              setSyncStatus('connecting');
              setRetryNonce((current) => current + 1);
            }}
            className="mt-3 min-h-11 rounded-xl bg-primary px-4 py-2 font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {copy.retry}
          </button>
        </div>
      ) : null}
    </div>
  );
}
