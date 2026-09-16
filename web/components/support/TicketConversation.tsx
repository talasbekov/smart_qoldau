'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';
import {
  reconcileReply,
  type PendingTicketReply,
  type TicketDetail,
} from '@/lib/support';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const BUTTON =
  'min-h-12 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

type Phase = 'loading' | 'ready' | 'missing' | 'error';
type Notice = 'sent' | 'unknown' | 'error' | null;

function stored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function TicketConversation({
  ticketId,
  locale,
}: {
  ticketId: string;
  locale: string;
}) {
  const copy = locale === 'kz' ? kz.supportPortal : ru.supportPortal;
  const draftKey = `smartqoldau:support:reply:${ticketId}:draft`;
  const pendingKey = `smartqoldau:support:reply:${ticketId}:pending`;
  const [phase, setPhase] = useState<Phase>('loading');
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState<PendingTicketReply | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const sendingRef = useRef(false);

  const confirmReply = useCallback(() => {
    localStorage.removeItem(draftKey);
    localStorage.removeItem(pendingKey);
    setBody('');
    setPending(null);
    setNotice('sent');
  }, [draftKey, pendingKey]);

  const applyDetail = useCallback(
    (next: TicketDetail, pendingReply: PendingTicketReply | null) => {
      setTicket(next);
      if (pendingReply && reconcileReply(next.messages, pendingReply)) {
        confirmReply();
      }
    },
    [confirmReply],
  );

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setPhase('loading');
    try {
      const pendingReply = stored<PendingTicketReply>(pendingKey);
      const result = await apiFetch<TicketDetail>(`tickets/${ticketId}`);
      if (!result) throw new Error('empty ticket');
      if (!mounted.current || version !== requestVersion.current) return;
      setPending(pendingReply);
      applyDetail(result, pendingReply);
      if (pendingReply && !reconcileReply(result.messages, pendingReply)) {
        setNotice('unknown');
      }
      setPhase('ready');
    } catch (error) {
      if (!mounted.current || version !== requestVersion.current) return;
      setPhase(
        error instanceof ApiError && error.status === 404 ? 'missing' : 'error',
      );
    }
  }, [applyDetail, pendingKey, ticketId]);

  useEffect(() => {
    mounted.current = true;
    setBody(localStorage.getItem(draftKey) ?? '');
    setHydrated(true);
    void load();
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
    };
  }, [draftKey, load]);

  useEffect(() => {
    if (!hydrated || !body) return;
    localStorage.setItem(draftKey, body);
  }, [body, draftKey, hydrated]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !ticket ||
      ticket.status === 'RESOLVED' ||
      pending ||
      sendingRef.current
    )
      return;

    const snapshot: PendingTicketReply = {
      body: body.trim(),
      baselineIds: ticket.messages.map((message) => message.id),
    };
    sendingRef.current = true;
    setSending(true);
    setNotice(null);
    setPending(snapshot);
    localStorage.setItem(pendingKey, JSON.stringify(snapshot));

    try {
      await apiFetch(`tickets/${ticketId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body: snapshot.body }),
      });
      if (!mounted.current) return;
      confirmReply();
      void load();
    } catch (error) {
      if (!mounted.current) return;
      const definitelyRejected =
        error instanceof ApiError && error.status >= 400 && error.status < 500;
      if (definitelyRejected) {
        localStorage.removeItem(pendingKey);
        setPending(null);
        setNotice('error');
        if (error.status === 409) void load();
      } else {
        try {
          const current = await apiFetch<TicketDetail>(`tickets/${ticketId}`);
          if (!mounted.current || !current) return;
          applyDetail(current, snapshot);
          if (!reconcileReply(current.messages, snapshot)) setNotice('unknown');
        } catch {
          if (mounted.current) setNotice('unknown');
        }
      }
    } finally {
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
  }

  if (phase === 'loading')
    return (
      <p role="status" className="text-sm text-body">
        {copy.detailLoading}
      </p>
    );

  if (phase === 'missing' || phase === 'error' || !ticket) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {phase === 'missing' ? copy.notFound : copy.detailError}
        </p>
        <button type="button" onClick={() => void load()} className={BUTTON}>
          {copy.retry}
        </button>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl">
      <Link
        href="/support/requests"
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {copy.back}
      </Link>
      <header className="mt-4 rounded-3xl bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-body">
              {copy.categories[ticket.category]}
            </p>
            <h1 className="mt-1 break-words text-2xl font-extrabold text-ink">
              {ticket.subject}
            </h1>
          </div>
          <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold text-primary">
            {copy.statuses[ticket.status]}
          </span>
        </div>
        <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
          {ticket.body}
        </p>
      </header>

      <section aria-labelledby="thread-title" className="mt-7">
        <h2 id="thread-title" className="text-xl font-extrabold text-ink">
          {copy.threadTitle}
        </h2>
        {ticket.messages.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-border p-5 text-sm text-body">
            {copy.noReplies}
          </p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {ticket.messages.map((message) => (
              <li
                key={message.id}
                className={`max-w-[90%] rounded-2xl p-4 sm:max-w-[80%] ${message.authorKind === 'user' ? 'ml-auto bg-chip' : 'mr-auto border border-border bg-white'}`}
              >
                <p className="text-xs font-bold text-muted">
                  {message.authorKind === 'user' ? copy.you : copy.staff}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
                  {message.body}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {ticket.status === 'RESOLVED' ? (
        <p className="mt-7 rounded-2xl bg-surface p-5 text-sm font-semibold text-body">
          {copy.resolvedReadOnly}
        </p>
      ) : (
        <form
          onSubmit={submit}
          className="mt-7 flex flex-col gap-3 border-t border-border pt-6"
        >
          <label
            htmlFor="ticket-reply"
            className="text-sm font-semibold text-ink-soft"
          >
            {copy.replyLabel}
          </label>
          <textarea
            id="ticket-reply"
            value={body}
            rows={5}
            maxLength={4000}
            required
            disabled={Boolean(pending)}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-32 w-full resize-y rounded-2xl border border-border px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {notice === 'sent' && (
            <p role="status" className="text-sm font-semibold text-primary">
              {copy.replySent}
            </p>
          )}
          {notice === 'unknown' && (
            <p role="alert" className="text-sm font-semibold text-amber-800">
              {copy.replyUnknown}
            </p>
          )}
          {notice === 'error' && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {copy.replyError}
            </p>
          )}
          <button
            type="submit"
            disabled={sending || Boolean(pending)}
            className={`${BUTTON} self-start`}
          >
            {sending ? copy.replying : copy.reply}
          </button>
        </form>
      )}
    </article>
  );
}
