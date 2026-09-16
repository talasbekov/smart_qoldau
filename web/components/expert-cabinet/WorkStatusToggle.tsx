'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const HEARTBEAT_MS = 30_000;

type WorkStatus = 'ACCEPTING' | 'BUSY' | 'NOT_ACCEPTING' | 'UNAVAILABLE';
type ExpertMe = { workStatus: WorkStatus };
type PendingAction = {
  generation: number;
  target: 'ACCEPTING' | 'NOT_ACCEPTING';
};
type TransitionModel = {
  intentAccepting: boolean;
  canonical: WorkStatus;
  canonicalRevision: number;
  unknownAccepting: boolean;
  generation: number;
  offlineQueuedFor: number | null;
  savingOwner: number | null;
  pendingAction: PendingAction | null;
};

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
  const transition = useRef<TransitionModel>({
    intentAccepting: initialAccepting,
    canonical: initial,
    canonicalRevision: 0,
    unknownAccepting: false,
    generation: 0,
    offlineQueuedFor: null,
    savingOwner: null,
    pendingAction: null,
  });
  const actionLock = useRef(false);
  const statusQueue = useRef<Promise<unknown>>(Promise.resolve());

  const beginSaving = useCallback((owner: number) => {
    transition.current.savingOwner = owner;
    if (mounted.current) setPhase('saving');
  }, []);

  const finishSaving = useCallback(
    (owner: number, nextPhase: 'idle' | 'error') => {
      if (transition.current.savingOwner !== owner) return;
      transition.current.savingOwner = null;
      if (mounted.current) setPhase(nextPhase);
    },
    [],
  );

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
          transition.current.intentAccepting &&
          transition.current.canonical === 'ACCEPTING' &&
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
    (
      workStatus: 'ACCEPTING' | 'NOT_ACCEPTING',
      keepalive = false,
      attempts = 1,
    ) => {
      const request = statusQueue.current
        .catch(() => null)
        .then(async () => {
          let lastError: unknown;
          for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
              return await apiFetch<ExpertMe>('experts/me/work-status', {
                method: 'PATCH',
                body: JSON.stringify({ workStatus }),
                keepalive,
              });
            } catch (caught) {
              lastError = caught;
            }
          }
          throw lastError;
        });
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
      transition.current.canonical = workStatus;
      transition.current.canonicalRevision += 1;
      if (!mounted.current) return;
      setCanonicalStatus(workStatus);
      if (workStatus === 'BUSY' || workStatus === 'UNAVAILABLE') {
        setAccepting(false);
        setConfirmedOnline(false);
        setPaused(false);
        stopHeartbeat();
      } else if (workStatus === 'ACCEPTING') {
        setAccepting(true);
      } else if (!transition.current.intentAccepting) {
        setAccepting(false);
        setConfirmedOnline(false);
      }
    },
    [stopHeartbeat],
  );

  const queueUnavailable = useCallback(() => {
    const generation = transition.current.generation;
    if (
      transition.current.offlineQueuedFor === generation ||
      transition.current.canonical === 'BUSY' ||
      transition.current.canonical === 'UNAVAILABLE'
    ) {
      return;
    }
    transition.current.offlineQueuedFor = generation;
    stopHeartbeat();
    if (mounted.current) setConfirmedOnline(false);

    void (async () => {
      try {
        // Both attempts are one serialized transition. A newer resume is
        // queued after the retry, never between the failed attempt and retry.
        const confirmed = await enqueueStatus('NOT_ACCEPTING', true, 2);
        if (confirmed?.workStatus === 'NOT_ACCEPTING') {
          transition.current.unknownAccepting = false;
          if (transition.current.generation === generation) {
            reflectCanonical('NOT_ACCEPTING');
          }
          if (
            mounted.current &&
            transition.current.generation === generation &&
            document.visibilityState !== 'visible'
          ) {
            setPhase('idle');
          }
        } else {
          throw new Error('status mismatch');
        }
      } catch {
        if (mounted.current && transition.current.generation === generation) {
          setPhase('error');
        }
      } finally {
        if (transition.current.offlineQueuedFor === generation) {
          transition.current.offlineQueuedFor = null;
        }
      }
    })();
  }, [enqueueStatus, reflectCanonical, stopHeartbeat]);

  const readCanonical = useCallback(
    async (
      expectedGeneration = transition.current.generation,
    ): Promise<WorkStatus | null> => {
      const requestedAtRevision = transition.current.canonicalRevision;
      const actual = await apiFetch<ExpertMe>('experts/me');
      if (!actual) throw new Error('status unavailable');
      if (transition.current.generation !== expectedGeneration) return null;
      if (
        transition.current.canonicalRevision !== requestedAtRevision &&
        (transition.current.canonical === 'BUSY' ||
          transition.current.canonical === 'UNAVAILABLE')
      ) {
        return transition.current.canonical;
      }
      return actual.workStatus;
    },
    [],
  );

  const applyCanonicalSnapshot = useCallback(
    (workStatus: WorkStatus, adoptIntent = false) => {
      transition.current.unknownAccepting = false;
      if (adoptIntent) {
        if (workStatus === 'ACCEPTING') {
          transition.current.intentAccepting = true;
        } else if (workStatus === 'NOT_ACCEPTING') {
          transition.current.intentAccepting = false;
        }
      }
      reflectCanonical(workStatus);
    },
    [reflectCanonical],
  );

  const applyVisibleIntent = useCallback(
    async (reconcileFirst = false) => {
      const operationGeneration = transition.current.generation;
      beginSaving(operationGeneration);
      try {
        const adoptRestoredManagedStatus =
          transition.current.canonical === 'BUSY' ||
          transition.current.canonical === 'UNAVAILABLE';
        const actual = reconcileFirst
          ? await readCanonical(operationGeneration)
          : transition.current.canonical;
        if (
          actual === null ||
          transition.current.generation !== operationGeneration
        ) {
          finishSaving(operationGeneration, 'idle');
          return;
        }
        if (reconcileFirst) {
          applyCanonicalSnapshot(actual, adoptRestoredManagedStatus);
        }
        if (
          actual === 'BUSY' ||
          actual === 'UNAVAILABLE' ||
          !transition.current.intentAccepting
        ) {
          finishSaving(operationGeneration, 'idle');
          return;
        }
        if (!mounted.current || document.visibilityState !== 'visible') {
          queueUnavailable();
          return;
        }

        const requestedAtRevision = transition.current.canonicalRevision;
        transition.current.unknownAccepting = true;
        const confirmed = await enqueueStatus('ACCEPTING');
        if (transition.current.generation !== operationGeneration) {
          finishSaving(operationGeneration, 'idle');
          return;
        }
        if (
          transition.current.canonicalRevision !== requestedAtRevision &&
          (transition.current.canonical === 'BUSY' ||
            transition.current.canonical === 'UNAVAILABLE')
        ) {
          finishSaving(operationGeneration, 'idle');
          return;
        }
        if (
          !mounted.current ||
          !transition.current.intentAccepting ||
          document.visibilityState !== 'visible'
        ) {
          queueUnavailable();
          return;
        }
        if (confirmed?.workStatus !== 'ACCEPTING') {
          throw new Error('status mismatch');
        }
        transition.current.unknownAccepting = false;
        reflectCanonical('ACCEPTING');
        setConfirmedOnline(true);
        finishSaving(operationGeneration, 'idle');
        startHeartbeat();
      } catch {
        if (transition.current.generation !== operationGeneration) {
          finishSaving(operationGeneration, 'idle');
          return;
        }
        if (!mounted.current || document.visibilityState !== 'visible') {
          if (
            transition.current.intentAccepting ||
            transition.current.unknownAccepting
          )
            queueUnavailable();
          return;
        }
        try {
          const actual = await readCanonical(operationGeneration);
          if (
            actual === null ||
            transition.current.generation !== operationGeneration
          ) {
            finishSaving(operationGeneration, 'idle');
            return;
          }
          applyCanonicalSnapshot(actual);
          if (actual === 'ACCEPTING' && transition.current.intentAccepting) {
            setConfirmedOnline(true);
            finishSaving(operationGeneration, 'idle');
            startHeartbeat();
          } else if (actual === 'BUSY' || actual === 'UNAVAILABLE') {
            finishSaving(operationGeneration, 'idle');
          } else {
            finishSaving(operationGeneration, 'error');
            stopHeartbeat();
          }
        } catch {
          if (mounted.current) {
            setConfirmedOnline(false);
            finishSaving(operationGeneration, 'error');
            stopHeartbeat();
          }
        }
      }
    },
    [
      beginSaving,
      enqueueStatus,
      finishSaving,
      applyCanonicalSnapshot,
      queueUnavailable,
      readCanonical,
      reflectCanonical,
      startHeartbeat,
      stopHeartbeat,
    ],
  );

  const reconcilePendingOffline = useCallback(async () => {
    const pending = transition.current.pendingAction;
    if (
      pending?.target !== 'NOT_ACCEPTING' ||
      transition.current.intentAccepting
    )
      return;

    const operationGeneration = transition.current.generation;
    beginSaving(operationGeneration);
    try {
      const actual = await readCanonical(operationGeneration);
      if (
        actual === null ||
        transition.current.generation !== operationGeneration
      ) {
        finishSaving(operationGeneration, 'idle');
        return;
      }
      if (
        transition.current.pendingAction !== pending ||
        transition.current.intentAccepting
      ) {
        finishSaving(operationGeneration, 'idle');
        return;
      }
      applyCanonicalSnapshot(actual);
      if (actual === 'BUSY' || actual === 'UNAVAILABLE') {
        transition.current.pendingAction = null;
        finishSaving(operationGeneration, 'idle');
        return;
      }
      if (actual !== 'NOT_ACCEPTING') {
        setAccepting(false);
        const confirmed = await enqueueStatus('NOT_ACCEPTING');
        if (confirmed?.workStatus !== 'NOT_ACCEPTING') {
          throw new Error('status mismatch');
        }
        if (
          transition.current.generation !== operationGeneration ||
          transition.current.pendingAction !== pending ||
          transition.current.intentAccepting
        ) {
          finishSaving(operationGeneration, 'idle');
          return;
        }
        reflectCanonical('NOT_ACCEPTING');
      }
      transition.current.pendingAction = null;
      setAccepting(false);
      setConfirmedOnline(false);
      finishSaving(operationGeneration, 'idle');
      stopHeartbeat();
    } catch {
      if (transition.current.generation !== operationGeneration) {
        finishSaving(operationGeneration, 'idle');
        return;
      }
      setConfirmedOnline(false);
      finishSaving(operationGeneration, 'error');
      stopHeartbeat();
    }
  }, [
    applyCanonicalSnapshot,
    beginSaving,
    enqueueStatus,
    finishSaving,
    readCanonical,
    reflectCanonical,
    stopHeartbeat,
  ]);

  useEffect(() => {
    const priorCanonical = transition.current.canonical;
    transition.current.generation += 1;
    reflectCanonical(initial);
    if (initial === 'ACCEPTING') {
      transition.current.intentAccepting = true;
      transition.current.unknownAccepting = false;
      setAccepting(true);
      if (
        priorCanonical !== 'ACCEPTING' &&
        document.visibilityState === 'visible'
      )
        startHeartbeat();
    } else if (initial === 'NOT_ACCEPTING') {
      transition.current.intentAccepting = false;
      transition.current.unknownAccepting = false;
      setAccepting(false);
    }
  }, [initial, reflectCanonical, startHeartbeat]);

  useEffect(() => {
    mounted.current = true;
    const model = transition.current;
    let firstSync = true;

    function syncVisibility() {
      transition.current.generation += 1;
      const hidden = document.visibilityState !== 'visible';
      const managed =
        transition.current.canonical === 'BUSY' ||
        transition.current.canonical === 'UNAVAILABLE';
      const needsSafetyOffline =
        transition.current.intentAccepting ||
        transition.current.unknownAccepting;
      setPaused(hidden && needsSafetyOffline && !managed);
      stopHeartbeat();

      if (hidden) {
        setConfirmedOnline(false);
        if (needsSafetyOffline && !managed) queueUnavailable();
      } else if (
        transition.current.pendingAction?.target === 'NOT_ACCEPTING' &&
        !transition.current.intentAccepting
      ) {
        void reconcilePendingOffline();
      } else if (managed) {
        // BUSY/UNAVAILABLE blocks writes, not canonical reads. Completion may
        // already have restored ACCEPTING on the server.
        void applyVisibleIntent(true);
      } else if (transition.current.intentAccepting) {
        void applyVisibleIntent(!firstSync);
      }
      firstSync = false;
    }

    function syncFromServer() {
      transition.current.generation += 1;
      if (
        transition.current.pendingAction?.target === 'NOT_ACCEPTING' &&
        !transition.current.intentAccepting
      ) {
        void reconcilePendingOffline();
      } else {
        void applyVisibleIntent(true);
      }
    }

    function acceptCanonicalEvent(event: Event) {
      const workStatus = (event as CustomEvent<WorkStatus>).detail;
      if (
        workStatus === 'ACCEPTING' ||
        workStatus === 'BUSY' ||
        workStatus === 'NOT_ACCEPTING' ||
        workStatus === 'UNAVAILABLE'
      ) {
        transition.current.generation += 1;
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
      model.generation += 1;
      if (model.intentAccepting || model.unknownAccepting) queueUnavailable();
    };
  }, [
    applyVisibleIntent,
    queueUnavailable,
    reconcilePendingOffline,
    reflectCanonical,
    stopHeartbeat,
  ]);

  useEffect(() => {
    if (
      document.visibilityState !== 'visible' ||
      (canonicalStatus !== 'BUSY' && canonicalStatus !== 'UNAVAILABLE')
    )
      return;
    const reconciliation = setInterval(() => {
      transition.current.generation += 1;
      void applyVisibleIntent(true);
    }, HEARTBEAT_MS);
    return () => clearInterval(reconciliation);
  }, [applyVisibleIntent, canonicalStatus]);

  async function toggle() {
    if (actionLock.current) return;
    if (canonicalStatus === 'BUSY' || canonicalStatus === 'UNAVAILABLE') return;
    actionLock.current = true;
    transition.current.generation += 1;
    const operationGeneration = transition.current.generation;
    const next = !transition.current.intentAccepting;
    const pendingAction: PendingAction = {
      generation: operationGeneration,
      target: next ? 'ACCEPTING' : 'NOT_ACCEPTING',
    };
    transition.current.pendingAction = pendingAction;
    transition.current.intentAccepting = next;
    if (next) transition.current.unknownAccepting = true;
    setAccepting(next);
    beginSaving(operationGeneration);
    if (!next) stopHeartbeat();

    try {
      const requestedAtRevision = transition.current.canonicalRevision;
      const confirmed = await enqueueStatus(
        next ? 'ACCEPTING' : 'NOT_ACCEPTING',
      );
      if (!mounted.current) return;
      if (transition.current.generation !== operationGeneration) {
        if (confirmed?.workStatus === pendingAction.target) {
          if (transition.current.pendingAction === pendingAction) {
            transition.current.pendingAction = null;
          }
          finishSaving(operationGeneration, 'idle');
        }
        return;
      }
      if (
        transition.current.canonicalRevision !== requestedAtRevision &&
        (transition.current.canonical === 'BUSY' ||
          transition.current.canonical === 'UNAVAILABLE')
      ) {
        if (transition.current.pendingAction === pendingAction) {
          transition.current.pendingAction = null;
        }
        finishSaving(operationGeneration, 'idle');
        return;
      }
      if (next && document.visibilityState !== 'visible') {
        queueUnavailable();
        return;
      }
      if (confirmed?.workStatus !== (next ? 'ACCEPTING' : 'NOT_ACCEPTING')) {
        throw new Error('status mismatch');
      }
      transition.current.unknownAccepting = false;
      if (transition.current.pendingAction === pendingAction) {
        transition.current.pendingAction = null;
      }
      reflectCanonical(confirmed.workStatus);
      setConfirmedOnline(next && document.visibilityState === 'visible');
      setPaused(next && document.visibilityState !== 'visible');
      finishSaving(operationGeneration, 'idle');
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
      if (transition.current.generation !== operationGeneration) return;
      try {
        const actual = await readCanonical(operationGeneration);
        if (
          actual === null ||
          transition.current.generation !== operationGeneration
        )
          return;
        if (
          !mounted.current ||
          transition.current.pendingAction !== pendingAction
        ) {
          finishSaving(operationGeneration, 'idle');
          return;
        }
        applyCanonicalSnapshot(actual, true);
        const actualAccepting = actual === 'ACCEPTING';
        if (transition.current.pendingAction === pendingAction) {
          transition.current.pendingAction = null;
        }
        setAccepting(actualAccepting);
        setConfirmedOnline(
          actualAccepting && document.visibilityState === 'visible',
        );
        setPaused(actualAccepting && document.visibilityState !== 'visible');
        finishSaving(
          operationGeneration,
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
          if (transition.current.pendingAction === pendingAction) {
            transition.current.pendingAction = null;
          }
          const fallbackAccepting =
            transition.current.canonical === 'ACCEPTING';
          transition.current.intentAccepting = fallbackAccepting;
          setAccepting(fallbackAccepting);
          setConfirmedOnline(false);
          finishSaving(operationGeneration, 'error');
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
