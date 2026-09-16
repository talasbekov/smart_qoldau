'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';
import {
  categoriesForAuthor,
  reconcileCreatedTicket,
  type PendingTicketCreate,
  type SupportAuthor,
  type TicketCategory,
  type TicketCreated,
  type TicketSummary,
} from '@/lib/support';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const DRAFT_KEY = 'smartqoldau:support:create:draft';
const PENDING_KEY = 'smartqoldau:support:create:pending';

const FIELD =
  'min-h-12 w-full rounded-2xl border border-border bg-white px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary';
const BUTTON =
  'min-h-12 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

type Phase = 'loading' | 'ready' | 'error';
type Notice = 'created' | 'unknown' | 'error' | null;
type ExpertProbe = { id?: string };

function readStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveStored(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function SupportCenter({ locale }: { locale: string }) {
  const copy = locale === 'kz' ? kz.supportPortal : ru.supportPortal;
  const [phase, setPhase] = useState<Phase>('loading');
  const [author, setAuthor] = useState<SupportAuthor | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [category, setCategory] = useState<TicketCategory>('CONSULTATIONS');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pending, setPending] = useState<PendingTicketCreate | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const requestVersion = useRef(0);
  const mounted = useRef(true);
  const submittingRef = useRef(false);

  const clearConfirmedCreate = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(PENDING_KEY);
    setPending(null);
    setSubject('');
    setBody('');
    setNotice('created');
  }, []);

  const applyTickets = useCallback(
    (items: TicketSummary[], pendingCreate: PendingTicketCreate | null) => {
      setTickets(items);
      if (pendingCreate && reconcileCreatedTicket(items, pendingCreate)) {
        clearConfirmedCreate();
      }
    },
    [clearConfirmedCreate],
  );

  const load = useCallback(
    async (withRoleProbe: boolean) => {
      const version = ++requestVersion.current;
      if (withRoleProbe) setPhase('loading');
      else setRefreshing(true);
      try {
        const pendingCreate = readStored<PendingTicketCreate>(PENDING_KEY);
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
        if (!mounted.current || version !== requestVersion.current) return;
        setAuthor(resolvedAuthor);
        if (resolvedAuthor) {
          const allowed = categoriesForAuthor(resolvedAuthor);
          setCategory((current) =>
            allowed.includes(current) ? current : allowed[0],
          );
        }
        setPending(pendingCreate);
        applyTickets(items, pendingCreate);
        if (pendingCreate && !reconcileCreatedTicket(items, pendingCreate)) {
          setNotice('unknown');
        }
        setRefreshing(false);
        setPhase('ready');
      } catch {
        if (!mounted.current || version !== requestVersion.current) return;
        setRefreshing(false);
        setPhase('error');
      }
    },
    [applyTickets, author],
  );

  useEffect(() => {
    mounted.current = true;
    const draft = readStored<{
      category?: TicketCategory;
      subject?: string;
      body?: string;
    }>(DRAFT_KEY);
    if (draft?.category) setCategory(draft.category);
    if (draft?.subject) setSubject(draft.subject);
    if (draft?.body) setBody(draft.body);
    setHydrated(true);
    void load(true);
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
    };
    // The initial load must run exactly once; later loads are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || (!subject && !body)) return;
    saveStored(DRAFT_KEY, { category, subject, body });
  }, [body, category, hydrated, subject]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current || pending) return;

    const snapshot: PendingTicketCreate = {
      category,
      subject: subject.trim(),
      baselineIds: tickets.map((ticket) => ticket.id),
    };
    submittingRef.current = true;
    setSubmitting(true);
    setNotice(null);
    setPending(snapshot);
    saveStored(PENDING_KEY, snapshot);

    try {
      await apiFetch<TicketCreated>('tickets', {
        method: 'POST',
        body: JSON.stringify({
          category: snapshot.category,
          subject: snapshot.subject,
          body: body.trim(),
        }),
      });
      if (!mounted.current) return;
      clearConfirmedCreate();
      void load(false);
    } catch (error) {
      if (!mounted.current) return;
      const definitelyRejected =
        error instanceof ApiError && error.status >= 400 && error.status < 500;
      if (definitelyRejected) {
        localStorage.removeItem(PENDING_KEY);
        setPending(null);
        setNotice('error');
      } else {
        try {
          const items =
            (await apiFetch<TicketSummary[]>('tickets?take=100')) ?? [];
          if (!mounted.current) return;
          applyTickets(items, snapshot);
          if (!reconcileCreatedTicket(items, snapshot)) setNotice('unknown');
        } catch {
          if (mounted.current) setNotice('unknown');
        }
      }
    } finally {
      submittingRef.current = false;
      if (mounted.current) setSubmitting(false);
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
              onChange={(event) =>
                setCategory(event.target.value as TicketCategory)
              }
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
              onChange={(event) => setSubject(event.target.value)}
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
              onChange={(event) => setBody(event.target.value)}
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

          <button
            type="submit"
            disabled={submitting || Boolean(pending)}
            className={BUTTON}
          >
            {submitting ? copy.creating : copy.create}
          </button>
        </form>
      </section>
    </div>
  );
}
