'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';
import {
  categoriesForAuthor,
  type SupportAuthor,
  type TicketCategory,
  type TicketCreated,
  type TicketSummary,
} from '@/lib/support';
import {
  activateSupportOwner,
  createSupportStorage,
  isSupportSessionCurrent,
  newSupportId,
  type PendingCreate,
  type PendingState,
  supportSessionEpochKey,
} from '@/lib/support-storage';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const FIELD =
  'min-h-12 w-full rounded-2xl border border-border bg-white px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary';
const BUTTON =
  'min-h-12 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

type Phase = 'loading' | 'ready' | 'error';
type Notice =
  'created' | 'unknown' | 'error' | 'storage' | 'corrupt' | 'session' | null;
type ExpertProbe = { id?: string };

export default function SupportCenter({
  locale,
  userId,
}: {
  locale: string;
  userId: string;
}) {
  const copy = locale === 'kz' ? kz.supportPortal : ru.supportPortal;
  const storage = useMemo(() => createSupportStorage(userId), [userId]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [author, setAuthor] = useState<SupportAuthor | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [category, setCategory] = useState<TicketCategory>('CONSULTATIONS');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pending, setPending] = useState<
    PendingState<PendingCreate> | 'corrupt' | 'session' | null
  >(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const requestVersion = useRef(0);
  const lifecycle = useRef(0);
  const submittingRef = useRef(false);
  const draftRevision = useRef(newSupportId());
  const persistedRevision = useRef<string | null>(null);
  const sessionEpoch = useRef('');

  const load = useCallback(
    async (withRoleProbe: boolean) => {
      const version = ++requestVersion.current;
      const generation = lifecycle.current;
      if (withRoleProbe) setPhase('loading');
      else setRefreshing(true);
      try {
        const listPromise = apiFetch<TicketSummary[]>('tickets?take=100');
        let resolvedAuthor = author;

        if (withRoleProbe || !resolvedAuthor) {
          try {
            await apiFetch<ExpertProbe>('experts/me');
            resolvedAuthor = 'expert';
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.status === 404 &&
              error.code === 'EXPERT_NOT_FOUND'
            ) {
              resolvedAuthor = 'client';
            } else {
              throw error;
            }
          }
        }

        const items = (await listPromise) ?? [];
        if (
          generation !== lifecycle.current ||
          version !== requestVersion.current
        )
          return;
        setAuthor(resolvedAuthor);
        if (resolvedAuthor) {
          const allowed = categoriesForAuthor(resolvedAuthor);
          setCategory((current) =>
            allowed.includes(current) ? current : allowed[0],
          );
        }
        setTickets(items);
        setRefreshing(false);
        setPhase('ready');
      } catch {
        if (
          generation !== lifecycle.current ||
          version !== requestVersion.current
        )
          return;
        setRefreshing(false);
        setPhase('error');
      }
    },
    [author],
  );

  useEffect(() => {
    const generation = lifecycle.current + 1;
    lifecycle.current = generation;
    requestVersion.current += 1;
    submittingRef.current = false;
    setPhase('loading');
    setAuthor(null);
    setTickets([]);
    setCategory('CONSULTATIONS');
    setSubject('');
    setBody('');
    setPending(null);
    setNotice(null);
    setSubmitting(false);
    setRefreshing(false);
    setHydrated(false);
    setStorageAvailable(true);
    const session = activateSupportOwner(userId);
    if (session.status === 'valid') sessionEpoch.current = session.epoch;
    else {
      sessionEpoch.current = '';
      setStorageAvailable(false);
      setNotice('storage');
    }

    const draft = storage.readCreateDraft();
    if (draft.status === 'valid') {
      draftRevision.current = draft.value.revision;
      persistedRevision.current = draft.value.revision;
      setCategory(draft.value.payload.category);
      setSubject(draft.value.payload.subject);
      setBody(draft.value.payload.body);
    } else {
      draftRevision.current = newSupportId();
      persistedRevision.current = null;
      if (draft.status === 'unavailable') {
        setStorageAvailable(false);
        setNotice('storage');
      }
    }
    const storedPending = storage.readCreatePending();
    if (storedPending.status === 'valid') {
      if (draft.status !== 'valid' && !('unknown' in storedPending.value)) {
        draftRevision.current = storedPending.value.draftRevision;
        setCategory(storedPending.value.payload.category);
        setSubject(storedPending.value.payload.subject);
        setBody(storedPending.value.payload.body);
      }
      setPending(storedPending.value);
      setNotice('unknown');
    } else if (storedPending.status === 'corrupt') {
      setPending('corrupt');
      setNotice('corrupt');
    } else if (storedPending.status === 'unavailable') {
      setStorageAvailable(false);
      setNotice('storage');
    }
    const syncCrossTabState = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== supportSessionEpochKey &&
        event.key !== storage.keys.createPending
      )
        return;
      if (
        !sessionEpoch.current ||
        !isSupportSessionCurrent(userId, sessionEpoch.current)
      ) {
        setSubject('');
        setBody('');
        setPending('session');
        setNotice('session');
        return;
      }
      const latest = storage.readCreatePending();
      if (latest.status === 'valid') {
        setPending(latest.value);
        setNotice('unknown');
      } else if (latest.status === 'corrupt') {
        setPending('corrupt');
        setNotice('corrupt');
      }
    };
    window.addEventListener('storage', syncCrossTabState);
    setHydrated(true);
    void load(true);
    return () => {
      if (lifecycle.current === generation) lifecycle.current += 1;
      requestVersion.current += 1;
      window.removeEventListener('storage', syncCrossTabState);
    };
    // The initial load must run exactly once; later loads are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage, userId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!subject && !body) {
      if (persistedRevision.current) {
        storage.removeCreateDraftIfRevision(persistedRevision.current);
        persistedRevision.current = null;
      }
      return;
    }
    const saved = storage.saveCreateDraft({
      revision: draftRevision.current,
      payload: { category, subject, body },
    });
    if (!saved) {
      setStorageAvailable(false);
      setNotice('storage');
    } else persistedRevision.current = draftRevision.current;
  }, [body, category, hydrated, storage, subject]);

  function reviseDraft() {
    draftRevision.current = newSupportId();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      submittingRef.current ||
      pending ||
      !storageAvailable ||
      !isSupportSessionCurrent(userId, sessionEpoch.current)
    ) {
      if (!isSupportSessionCurrent(userId, sessionEpoch.current)) {
        setSubject('');
        setBody('');
        setPending('session');
        setNotice('session');
      }
      if (!storageAvailable) setNotice('storage');
      return;
    }

    const snapshot: PendingCreate = {
      operationId: newSupportId(),
      draftRevision: draftRevision.current,
      payload: {
        category,
        subject: subject.trim(),
        body: body.trim(),
      },
      baselineIds: tickets.map((ticket) => ticket.id),
    };
    submittingRef.current = true;
    setSubmitting(true);
    setNotice(null);
    const generation = lifecycle.current;
    const acquired = await storage.acquireCreatePending(snapshot);
    if (generation !== lifecycle.current) {
      if (acquired === 'acquired')
        storage.removeCreatePendingIfOperation(snapshot.operationId);
      return;
    }
    if (acquired !== 'acquired') {
      submittingRef.current = false;
      setSubmitting(false);
      if (acquired === 'occupied') {
        const latest = storage.readCreatePending();
        setPending(latest.status === 'valid' ? latest.value : 'corrupt');
        setNotice(latest.status === 'corrupt' ? 'corrupt' : 'unknown');
      } else {
        setStorageAvailable(false);
        setNotice('storage');
      }
      return;
    }
    if (!isSupportSessionCurrent(userId, sessionEpoch.current)) {
      storage.removeCreatePendingIfOperation(snapshot.operationId);
      submittingRef.current = false;
      setSubmitting(false);
      setSubject('');
      setBody('');
      setPending('session');
      setNotice('session');
      return;
    }
    // A durable, exclusively acquired marker exists before the request leaves.
    setPending(snapshot);

    try {
      await apiFetch<TicketCreated>('tickets', {
        method: 'POST',
        headers: { 'X-Support-Owner': userId },
        body: JSON.stringify({
          category: snapshot.payload.category,
          subject: snapshot.payload.subject,
          body: snapshot.payload.body,
        }),
      });
      storage.removeCreatePendingIfOperation(snapshot.operationId);
      storage.removeCreateDraftIfRevision(snapshot.draftRevision);
      if (
        generation !== lifecycle.current ||
        !isSupportSessionCurrent(userId, sessionEpoch.current)
      )
        return;
      setPending(null);
      if (draftRevision.current === snapshot.draftRevision) {
        draftRevision.current = newSupportId();
        setSubject('');
        setBody('');
      }
      setNotice('created');
      void load(false);
    } catch (error) {
      const definitelyRejected =
        error instanceof ApiError && error.status >= 400 && error.status < 500;
      if (definitelyRejected) {
        storage.removeCreatePendingIfOperation(snapshot.operationId);
      }
      if (generation !== lifecycle.current) return;
      if (
        error instanceof ApiError &&
        error.code === 'SUPPORT_SESSION_CHANGED'
      ) {
        setSubject('');
        setBody('');
        setPending('session');
        setNotice('session');
        return;
      }
      if (!isSupportSessionCurrent(userId, sessionEpoch.current)) {
        setSubject('');
        setBody('');
        setPending('session');
        setNotice('session');
        return;
      }
      if (definitelyRejected) {
        setPending(null);
        setNotice('error');
      } else {
        try {
          const items =
            (await apiFetch<TicketSummary[]>('tickets?take=100')) ?? [];
          if (generation !== lifecycle.current) return;
          setTickets(items);
          setNotice('unknown');
        } catch {
          if (generation === lifecycle.current) setNotice('unknown');
        }
      }
    } finally {
      if (generation === lifecycle.current) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  }

  if (phase === 'loading') {
    return (
      <p role="status" className="text-sm text-body">
        {copy.loading}
      </p>
    );
  }

  if (phase === 'error' || !author) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {copy.loadError}
        </p>
        <button
          type="button"
          className={BUTTON}
          onClick={() => void load(true)}
        >
          {copy.retry}
        </button>
      </div>
    );
  }

  const categories = categoriesForAuthor(author);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
      <section aria-labelledby="own-tickets-title" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="own-tickets-title"
              className="text-xl font-extrabold text-ink"
            >
              {copy.ownTitle}
            </h2>
            <p className="mt-1 text-sm text-body">{copy.firstResponse}</p>
          </div>
          <button
            type="button"
            onClick={() => void load(false)}
            aria-busy={refreshing}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {refreshing ? copy.refreshing : copy.refresh}
          </button>
        </div>

        {tickets.length === 0 ? (
          <p className="rounded-2xl bg-surface p-6 text-sm text-body">
            {copy.empty}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="rounded-2xl border border-border bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-bold text-ink">
                      {ticket.subject}
                    </p>
                    <p className="mt-1 text-sm text-body">
                      {copy.categories[ticket.category]} ·{' '}
                      {new Intl.DateTimeFormat(
                        locale === 'kz' ? 'kk-KZ' : 'ru-RU',
                        { dateStyle: 'medium' },
                      ).format(new Date(ticket.createdAt))}
                    </p>
                  </div>
                  <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold text-primary">
                    {copy.statuses[ticket.status]}
                  </span>
                </div>
                <Link
                  href={`/support/requests/${ticket.id}`}
                  className="mt-4 inline-flex min-h-11 items-center rounded-xl text-sm font-bold text-primary underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {copy.open}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="create-ticket-title"
        className="rounded-3xl bg-surface p-5 sm:p-6"
      >
        <h2
          id="create-ticket-title"
          className="text-xl font-extrabold text-ink"
        >
          {copy.createTitle}
        </h2>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <div>
            <label
              htmlFor="support-category"
              className="mb-1 block text-sm font-semibold text-ink-soft"
            >
              {copy.categoryLabel}
            </label>
            <select
              id="support-category"
              value={category}
              disabled={Boolean(pending)}
              onChange={(event) => {
                reviseDraft();
                setCategory(event.target.value as TicketCategory);
              }}
              className={FIELD}
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {copy.categories[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="support-subject"
              className="mb-1 block text-sm font-semibold text-ink-soft"
            >
              {copy.subjectLabel}
            </label>
            <input
              id="support-subject"
              value={subject}
              maxLength={200}
              required
              disabled={Boolean(pending)}
              onChange={(event) => {
                reviseDraft();
                setSubject(event.target.value);
              }}
              className={FIELD}
            />
          </div>
          <div>
            <label
              htmlFor="support-body"
              className="mb-1 block text-sm font-semibold text-ink-soft"
            >
              {copy.bodyLabel}
            </label>
            <textarea
              id="support-body"
              value={body}
              maxLength={4000}
              rows={6}
              required
              disabled={Boolean(pending)}
              onChange={(event) => {
                reviseDraft();
                setBody(event.target.value);
              }}
              className={`${FIELD} resize-y`}
            />
          </div>

          {notice === 'created' && (
            <p role="status" className="text-sm font-semibold text-primary">
              {copy.created}
            </p>
          )}
          {notice === 'unknown' && (
            <p role="alert" className="text-sm font-semibold text-amber-800">
              {copy.createUnknown}
            </p>
          )}
          {notice === 'error' && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {copy.createError}
            </p>
          )}
          {notice === 'storage' && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {copy.storageUnavailable}
            </p>
          )}
          {notice === 'corrupt' && (
            <p role="alert" className="text-sm font-semibold text-amber-800">
              {copy.pendingCorrupt}
            </p>
          )}
          {notice === 'session' && (
            <p role="alert" className="text-sm font-semibold text-amber-800">
              {copy.sessionChanged}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || Boolean(pending) || !storageAvailable}
            className={BUTTON}
          >
            {submitting ? copy.creating : copy.create}
          </button>
        </form>
      </section>
    </div>
  );
}
