'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const HEARTBEAT_MS = 30_000;

type WorkStatus = 'ACCEPTING' | 'BUSY' | 'NOT_ACCEPTING' | 'UNAVAILABLE';
type ExpertMe = { workStatus: WorkStatus };

const STATUS_EVENT = 'sq:expert-work-status';
const STATUS_SYNC_EVENT = 'sq:expert-work-status-sync';

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
  const [canonicalStatus, setCanonicalStatus] = useState(initial);
  const [confirmedOnline, setConfirmedOnline] = useState(false);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const desiredAccepting = useRef(initialAccepting);
  const canonicalStatusRef = useRef<WorkStatus>(initial);
  const canonicalRevision = useRef(0);
  const compensationQueued = useRef(false);
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
    (workStatus: 'ACCEPTING' | 'NOT_ACCEPTING', keepalive = false) => {
      const request = statusQueue.current
        .catch(() => null)
        .then(() =>
          apiFetch<ExpertMe>('experts/me/work-status', {
            method: 'PATCH',
            body: JSON.stringify({ workStatus }),
            keepalive,
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

  const reflectCanonical = useCallback(
    (workStatus: WorkStatus) => {
      canonicalStatusRef.current = workStatus;
      canonicalRevision.current += 1;
      if (!mounted.current) return;
      setCanonicalStatus(workStatus);
      if (workStatus === 'BUSY' || workStatus === 'UNAVAILABLE') {
        setAccepting(false);
        setConfirmedOnline(false);
        setPaused(false);
        stopHeartbeat();
      } else if (workStatus === 'ACCEPTING') {
        setAccepting(true);
      } else if (!desiredAccepting.current) {
        setAccepting(false);
        setConfirmedOnline(false);
      }
    },
    [stopHeartbeat],
  );

  const queueUnavailable = useCallback(() => {
    if (
      compensationQueued.current ||
      canonicalStatusRef.current === 'BUSY' ||
      canonicalStatusRef.current === 'UNAVAILABLE'
    ) {
      return;
    }
    compensationQueued.current = true;
    stopHeartbeat();
    if (mounted.current) setConfirmedOnline(false);

    void (async () => {
      try {
        let confirmed: ExpertMe | null = null;
        try {
          confirmed = await enqueueStatus('NOT_ACCEPTING', true);
          if (confirmed?.workStatus !== 'NOT_ACCEPTING') {
            throw new Error('status mismatch');
          }
        } catch {
          // Safety compensation is idempotent. Retry once when its response
          // is lost so a late ACCEPTING cannot survive a hidden/unloaded tab.
          confirmed = await enqueueStatus('NOT_ACCEPTING', true);
        }
        if (confirmed?.workStatus === 'NOT_ACCEPTING') {
          reflectCanonical('NOT_ACCEPTING');
          if (mounted.current && document.visibilityState !== 'visible') {
            setPhase('idle');
          }
        }
      } catch {
        if (mounted.current) setPhase('error');
      } finally {
        compensationQueued.current = false;
      }
    })();
  }, [enqueueStatus, reflectCanonical, stopHeartbeat]);

  const readCanonical = useCallback(async (): Promise<WorkStatus> => {
    const requestedAtRevision = canonicalRevision.current;
    const actual = await apiFetch<ExpertMe>('experts/me');
    if (!actual) throw new Error('status unavailable');
    if (
      canonicalRevision.current !== requestedAtRevision &&
      (canonicalStatusRef.current === 'BUSY' ||
        canonicalStatusRef.current === 'UNAVAILABLE')
    ) {
      return canonicalStatusRef.current;
    }
    reflectCanonical(actual.workStatus);
    return actual.workStatus;
  }, [reflectCanonical]);

  const applyVisibleIntent = useCallback(
    async (reconcileFirst = false) => {
      setPhase('saving');
      try {
        const actual = reconcileFirst
          ? await readCanonical()
          : canonicalStatusRef.current;
        if (
          actual === 'BUSY' ||
          actual === 'UNAVAILABLE' ||
          !desiredAccepting.current
        ) {
          if (mounted.current) setPhase('idle');
          return;
        }
        if (!mounted.current || document.visibilityState !== 'visible') {
          queueUnavailable();
          return;
        }

        const requestedAtRevision = canonicalRevision.current;
        const confirmed = await enqueueStatus('ACCEPTING');
        if (
          canonicalRevision.current !== requestedAtRevision &&
          (canonicalStatusRef.current === 'BUSY' ||
            canonicalStatusRef.current === 'UNAVAILABLE')
        ) {
          if (mounted.current) setPhase('idle');
          return;
        }
        if (
          !mounted.current ||
          !desiredAccepting.current ||
          document.visibilityState !== 'visible'
        ) {
          queueUnavailable();
          return;
        }
        if (confirmed?.workStatus !== 'ACCEPTING') {
          throw new Error('status mismatch');
        }
        reflectCanonical('ACCEPTING');
        setConfirmedOnline(true);
        setPhase('idle');
        startHeartbeat();
      } catch {
        if (!mounted.current || document.visibilityState !== 'visible') {
          if (desiredAccepting.current) queueUnavailable();
          return;
        }
        try {
          const actual = await readCanonical();
          if (actual === 'ACCEPTING' && desiredAccepting.current) {
            setConfirmedOnline(true);
            setPhase('idle');
            startHeartbeat();
          } else if (actual === 'BUSY' || actual === 'UNAVAILABLE') {
            setPhase('idle');
          } else {
            setPhase('error');
            stopHeartbeat();
          }
        } catch {
          if (mounted.current) {
            setConfirmedOnline(false);
            setPhase('error');
            stopHeartbeat();
          }
        }
      }
    },
    [
      enqueueStatus,
      queueUnavailable,
      readCanonical,
      reflectCanonical,
      startHeartbeat,
      stopHeartbeat,
    ],
  );

  useEffect(() => {
    reflectCanonical(initial);
    if (initial === 'ACCEPTING') {
      desiredAccepting.current = true;
      setAccepting(true);
    } else if (initial === 'NOT_ACCEPTING') {
      desiredAccepting.current = false;
      setAccepting(false);
    }
  }, [initial, reflectCanonical]);

  useEffect(() => {
    mounted.current = true;
    let firstSync = true;

    function syncVisibility() {
      const hidden = document.visibilityState !== 'visible';
      const managed =
        canonicalStatusRef.current === 'BUSY' ||
        canonicalStatusRef.current === 'UNAVAILABLE';
      setPaused(hidden && desiredAccepting.current && !managed);
      stopHeartbeat();

      if (hidden) {
        setConfirmedOnline(false);
        if (desiredAccepting.current && !managed) queueUnavailable();
      } else if (desiredAccepting.current && !managed) {
        void applyVisibleIntent(!firstSync);
      }
      firstSync = false;
    }

    function syncFromServer() {
      void applyVisibleIntent(true);
    }

    function acceptCanonicalEvent(event: Event) {
      const workStatus = (event as CustomEvent<WorkStatus>).detail;
      if (
        workStatus === 'ACCEPTING' ||
        workStatus === 'BUSY' ||
        workStatus === 'NOT_ACCEPTING' ||
        workStatus === 'UNAVAILABLE'
      ) {
        reflectCanonical(workStatus);
      }
    }

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener(STATUS_SYNC_EVENT, syncFromServer);
    window.addEventListener(STATUS_EVENT, acceptCanonicalEvent);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener(STATUS_SYNC_EVENT, syncFromServer);
      window.removeEventListener(STATUS_EVENT, acceptCanonicalEvent);
      stopHeartbeat();
      if (desiredAccepting.current) queueUnavailable();
    };
  }, [applyVisibleIntent, queueUnavailable, reflectCanonical, stopHeartbeat]);

  async function toggle() {
    if (actionLock.current) return;
    if (canonicalStatus === 'BUSY' || canonicalStatus === 'UNAVAILABLE') return;
    actionLock.current = true;
    const next = !desiredAccepting.current;
    desiredAccepting.current = next;
    setAccepting(next);
    setPhase('saving');
    if (!next) stopHeartbeat();

    try {
      const requestedAtRevision = canonicalRevision.current;
      const confirmed = await enqueueStatus(
        next ? 'ACCEPTING' : 'NOT_ACCEPTING',
      );
      if (!mounted.current) return;
      if (
        canonicalRevision.current !== requestedAtRevision &&
        (canonicalStatusRef.current === 'BUSY' ||
          canonicalStatusRef.current === 'UNAVAILABLE')
      ) {
        setPhase('idle');
        return;
      }
      if (next && document.visibilityState !== 'visible') {
        queueUnavailable();
        return;
      }
      if (confirmed?.workStatus !== (next ? 'ACCEPTING' : 'NOT_ACCEPTING')) {
        throw new Error('status mismatch');
      }
      reflectCanonical(confirmed.workStatus);
      setConfirmedOnline(next && document.visibilityState === 'visible');
      setPaused(next && document.visibilityState !== 'visible');
      setPhase('idle');
      if (next && document.visibilityState === 'visible') startHeartbeat();
      else stopHeartbeat();
    } catch {
      if (
        next &&
        (!mounted.current || document.visibilityState !== 'visible')
      ) {
        queueUnavailable();
        return;
      }
      try {
        const actual = await readCanonical();
        if (!mounted.current) return;
        const actualAccepting = actual === 'ACCEPTING';
        desiredAccepting.current = actual === 'BUSY' ? next : actualAccepting;
        setAccepting(actualAccepting);
        setConfirmedOnline(
          actualAccepting && document.visibilityState === 'visible',
        );
        setPaused(actualAccepting && document.visibilityState !== 'visible');
        setPhase(
          actual === 'BUSY' || actual === 'UNAVAILABLE'
            ? 'idle'
            : actualAccepting === next
              ? 'idle'
              : 'error',
        );
        if (actualAccepting && document.visibilityState === 'visible')
          startHeartbeat();
        else stopHeartbeat();
      } catch {
        if (mounted.current) {
          const fallbackAccepting = canonicalStatusRef.current === 'ACCEPTING';
          desiredAccepting.current = fallbackAccepting;
          setAccepting(fallbackAccepting);
          setConfirmedOnline(false);
          setPhase('error');
        }
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
        disabled={
          phase === 'saving' ||
          canonicalStatus === 'BUSY' ||
          canonicalStatus === 'UNAVAILABLE'
        }
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
