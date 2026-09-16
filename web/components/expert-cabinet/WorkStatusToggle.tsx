'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const HEARTBEAT_MS = 30_000;

type WorkStatus = 'ACCEPTING' | 'BUSY' | 'NOT_ACCEPTING' | 'UNAVAILABLE';
type ExpertMe = { workStatus: WorkStatus };

export default function WorkStatusToggle({
  initial,
  locale = 'ru',
}: {
  initial: WorkStatus;
  locale?: string;
}) {
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const initialAccepting = initial === 'ACCEPTING';
  const [accepting, setAccepting] = useState(initialAccepting);
  const [confirmedOnline, setConfirmedOnline] = useState(false);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const desiredAccepting = useRef(initialAccepting);
  const actionLock = useRef(false);
  const statusQueue = useRef<Promise<unknown>>(Promise.resolve());

  const stopHeartbeat = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const heartbeat = useCallback(() => {
    void apiFetch('experts/me/heartbeat', { method: 'POST' })
      .then(() => {
        if (
          mounted.current &&
          desiredAccepting.current &&
          document.visibilityState === 'visible'
        ) {
          setConfirmedOnline(true);
          setPhase('idle');
        }
      })
      .catch(() => {
        if (mounted.current) {
          setConfirmedOnline(false);
          setPhase('error');
        }
      });
  }, []);

  const startHeartbeat = useCallback(() => {
    if (timer.current) return;
    heartbeat();
    timer.current = setInterval(heartbeat, HEARTBEAT_MS);
  }, [heartbeat]);

  const enqueueStatus = useCallback(
    (workStatus: 'ACCEPTING' | 'NOT_ACCEPTING') => {
      const request = statusQueue.current
        .catch(() => null)
        .then(() =>
          apiFetch<ExpertMe>('experts/me/work-status', {
            method: 'PATCH',
            body: JSON.stringify({ workStatus }),
          }),
        );
      statusQueue.current = request.then(
        () => undefined,
        () => undefined,
      );
      return request;
    },
    [],
  );

  const applyVisibleIntent = useCallback(async () => {
    if (!desiredAccepting.current) return;
    setPhase('saving');
    try {
      const confirmed = await enqueueStatus('ACCEPTING');
      if (
        !mounted.current ||
        !desiredAccepting.current ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      if (confirmed?.workStatus !== 'ACCEPTING')
        throw new Error('status mismatch');
      setConfirmedOnline(true);
      setPhase('idle');
      startHeartbeat();
    } catch {
      if (!mounted.current) return;
      setConfirmedOnline(false);
      setPhase('error');
      stopHeartbeat();
    }
  }, [enqueueStatus, startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    mounted.current = true;

    function syncVisibility() {
      const hidden = document.visibilityState !== 'visible';
      setPaused(hidden && desiredAccepting.current);
      stopHeartbeat();

      if (!desiredAccepting.current) return;
      if (hidden) {
        setConfirmedOnline(false);
        void enqueueStatus('NOT_ACCEPTING')
          .then(() => {
            if (mounted.current && document.visibilityState !== 'visible') {
              setPhase('idle');
            }
          })
          .catch(() => null);
      } else {
        void applyVisibleIntent();
      }
    }

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', syncVisibility);
      stopHeartbeat();
      if (desiredAccepting.current) {
        void apiFetch('experts/me/work-status', {
          method: 'PATCH',
          body: JSON.stringify({ workStatus: 'NOT_ACCEPTING' }),
          keepalive: true,
        }).catch(() => null);
      }
    };
  }, [applyVisibleIntent, enqueueStatus, stopHeartbeat]);

  async function toggle() {
    if (actionLock.current) return;
    actionLock.current = true;
    const next = !desiredAccepting.current;
    setPhase('saving');

    try {
      const confirmed = await enqueueStatus(
        next ? 'ACCEPTING' : 'NOT_ACCEPTING',
      );
      if (!mounted.current) return;
      if (confirmed?.workStatus !== (next ? 'ACCEPTING' : 'NOT_ACCEPTING')) {
        throw new Error('status mismatch');
      }
      desiredAccepting.current = next;
      setAccepting(next);
      setConfirmedOnline(next && document.visibilityState === 'visible');
      setPaused(next && document.visibilityState !== 'visible');
      setPhase('idle');
      if (next && document.visibilityState === 'visible') startHeartbeat();
      else stopHeartbeat();
    } catch {
      try {
        const actual = await apiFetch<ExpertMe>('experts/me');
        if (!mounted.current) return;
        if (!actual) throw new Error('status unavailable');
        const actualAccepting = actual.workStatus === 'ACCEPTING';
        desiredAccepting.current = actualAccepting;
        setAccepting(actualAccepting);
        setConfirmedOnline(
          actualAccepting && document.visibilityState === 'visible',
        );
        setPaused(actualAccepting && document.visibilityState !== 'visible');
        setPhase(actualAccepting === next ? 'idle' : 'error');
        if (actualAccepting && document.visibilityState === 'visible')
          startHeartbeat();
        else stopHeartbeat();
      } catch {
        if (mounted.current) setPhase('error');
      }
    } finally {
      actionLock.current = false;
    }
  }

  const label =
    phase === 'saving'
      ? copy.statusSaving
      : accepting
        ? copy.accepting
        : copy.notAccepting;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={accepting}
        onClick={toggle}
        disabled={phase === 'saving'}
        className="flex min-h-11 items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-ink disabled:cursor-wait disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span
          aria-hidden="true"
          className={`h-3 w-3 rounded-full ${confirmedOnline ? 'bg-primary' : 'bg-faint'}`}
        />
        {label}
      </button>
      <p className="text-xs text-muted">{copy.statusHint}</p>
      {paused ? (
        <p role="status" className="text-xs font-semibold text-muted">
          {copy.statusPaused}
        </p>
      ) : null}
      {phase === 'error' ? (
        <p role="alert" className="text-xs font-semibold text-red-700">
          {copy.statusError}
        </p>
      ) : null}
    </div>
  );
}
