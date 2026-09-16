'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';
import type { TicketDetail } from '@/lib/support';
import {
  activateSupportOwner,
  createSupportStorage,
  isSupportSessionCurrent,
  newSupportId,
  type PendingReply,
  type PendingState,
  supportSessionEpochKey,
} from '@/lib/support-storage';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const BUTTON =
  'min-h-12 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

type Phase = 'loading' | 'ready' | 'missing' | 'error';
type Notice =
  'sent' | 'unknown' | 'error' | 'storage' | 'corrupt' | 'session' | null;

export default function TicketConversation({
  ticketId,
  locale,
  userId,
}: {
  ticketId: string;
  locale: string;
  userId: string;
}) {
  const copy = locale === 'kz' ? kz.supportPortal : ru.supportPortal;
  const storage = useMemo(() => createSupportStorage(userId), [userId]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState<
    PendingState<PendingReply> | 'corrupt' | 'session' | null
  >(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const lifecycle = useRef(0);
  const requestVersion = useRef(0);
  const sendingRef = useRef(false);
  const draftRevision = useRef(newSupportId());
  const persistedRevision = useRef<string | null>(null);
  const sessionEpoch = useRef('');

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    const generation = lifecycle.current;
    setPhase('loading');
    try {
      const result = await apiFetch<TicketDetail>(`tickets/${ticketId}`);
      if (!result) throw new Error('empty ticket');
      if (
        generation !== lifecycle.current ||
        version !== requestVersion.current
      )
        return;
      setTicket(result);
      setPhase('ready');
    } catch (error) {
      if (
        generation !== lifecycle.current ||
        version !== requestVersion.current
      )
        return;
      setPhase(
        error instanceof ApiError && error.status === 404 ? 'missing' : 'error',
      );
    }
  }, [ticketId]);

  useEffect(() => {
    const generation = lifecycle.current + 1;
    lifecycle.current = generation;
    requestVersion.current += 1;
    sendingRef.current = false;
    setPhase('loading');
    setTicket(null);
    setBody('');
    setPending(null);
    setNotice(null);
    setSending(false);
    setHydrated(false);
    setStorageAvailable(true);
    const session = activateSupportOwner(userId);
    if (session.status === 'valid') sessionEpoch.current = session.epoch;
    else {
      sessionEpoch.current = '';
      setStorageAvailable(false);
      setNotice('storage');
    }

    const draft = storage.readReplyDraft(ticketId);
    if (draft.status === 'valid') {
      draftRevision.current = draft.value.revision;
      persistedRevision.current = draft.value.revision;
      setBody(draft.value.payload.body);
    } else {
      draftRevision.current = newSupportId();
      persistedRevision.current = null;
      if (draft.status === 'unavailable') {
        setStorageAvailable(false);
        setNotice('storage');
      }
    }
    const storedPending = storage.readReplyPending(ticketId);
    if (storedPending.status === 'valid') {
      if (draft.status !== 'valid' && !('unknown' in storedPending.value)) {
        draftRevision.current = storedPending.value.draftRevision;
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
        event.key !== storage.keys.replyPending(ticketId)
      )
        return;
      if (
        !sessionEpoch.current ||
        !isSupportSessionCurrent(userId, sessionEpoch.current)
      ) {
        setBody('');
        setPending('session');
        setNotice('session');
        return;
      }
      const latest = storage.readReplyPending(ticketId);
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
    void load();
    return () => {
      if (lifecycle.current === generation) lifecycle.current += 1;
      requestVersion.current += 1;
      window.removeEventListener('storage', syncCrossTabState);
    };
  }, [load, storage, ticketId, userId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!body) {
      if (persistedRevision.current) {
        storage.removeReplyDraftIfRevision(ticketId, persistedRevision.current);
        persistedRevision.current = null;
      }
      return;
    }
    const saved = storage.saveReplyDraft(ticketId, {
      revision: draftRevision.current,
      payload: { body },
    });
    if (!saved) {
      setStorageAvailable(false);
      setNotice('storage');
    } else persistedRevision.current = draftRevision.current;
  }, [body, hydrated, storage, ticketId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !ticket ||
      ticket.status === 'RESOLVED' ||
      pending ||
      !storageAvailable ||
      !isSupportSessionCurrent(userId, sessionEpoch.current) ||
      sendingRef.current
    ) {
      if (!isSupportSessionCurrent(userId, sessionEpoch.current)) {
        setBody('');
        setPending('session');
        setNotice('session');
      }
      return;
    }

    const snapshot: PendingReply = {
      operationId: newSupportId(),
      draftRevision: draftRevision.current,
      payload: { body: body.trim() },
      baselineIds: ticket.messages.map((message) => message.id),
    };
    sendingRef.current = true;
    setSending(true);
    setNotice(null);
    const generation = lifecycle.current;
    const acquired = await storage.acquireReplyPending(ticketId, snapshot);
    if (generation !== lifecycle.current) {
      if (acquired === 'acquired')
        storage.removeReplyPendingIfOperation(ticketId, snapshot.operationId);
      return;
    }
    if (acquired !== 'acquired') {
      sendingRef.current = false;
      setSending(false);
      if (acquired === 'occupied') {
        const latest = storage.readReplyPending(ticketId);
        setPending(latest.status === 'valid' ? latest.value : 'corrupt');
        setNotice(latest.status === 'corrupt' ? 'corrupt' : 'unknown');
      } else {
        setStorageAvailable(false);
        setNotice('storage');
      }
      return;
    }
    if (!isSupportSessionCurrent(userId, sessionEpoch.current)) {
      storage.removeReplyPendingIfOperation(ticketId, snapshot.operationId);
      sendingRef.current = false;
      setSending(false);
      setBody('');
      setPending('session');
      setNotice('session');
      return;
    }
    setPending(snapshot);

    try {
      await apiFetch(`tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'X-Support-Owner': userId },
        body: JSON.stringify({ body: snapshot.payload.body }),
      });
      if (
        generation !== lifecycle.current ||
        !isSupportSessionCurrent(userId, sessionEpoch.current)
      )
        return;
      storage.removeReplyPendingIfOperation(ticketId, snapshot.operationId);
      storage.removeReplyDraftIfRevision(ticketId, snapshot.draftRevision);
      setPending(null);
      if (draftRevision.current === snapshot.draftRevision) {
        draftRevision.current = newSupportId();
        setBody('');
      }
      setNotice('sent');
      void load();
    } catch (error) {
      if (generation !== lifecycle.current) return;
      if (
        error instanceof ApiError &&
        error.code === 'SUPPORT_SESSION_CHANGED'
      ) {
        storage.removeReplyPendingIfOperation(ticketId, snapshot.operationId);
        setBody('');
        setPending('session');
        setNotice('session');
        return;
      }
      if (!isSupportSessionCurrent(userId, sessionEpoch.current)) {
        setBody('');
        setPending('session');
        setNotice('session');
        return;
      }
      const definitelyRejected =
        error instanceof ApiError && error.status >= 400 && error.status < 500;
      if (definitelyRejected) {
        storage.removeReplyPendingIfOperation(ticketId, snapshot.operationId);
        setPending(null);
        setNotice('error');
        if (error.status === 409) void load();
      } else {
        try {
          const current = await apiFetch<TicketDetail>(`tickets/${ticketId}`);
          if (generation !== lifecycle.current || !current) return;
          setTicket(current);
          setNotice('unknown');
        } catch {
          if (generation === lifecycle.current) setNotice('unknown');
        }
      }
    } finally {
      if (generation === lifecycle.current) {
        sendingRef.current = false;
        setSending(false);
      }
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
            onChange={(event) => {
              draftRevision.current = newSupportId();
              setBody(event.target.value);
            }}
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
            disabled={sending || Boolean(pending) || !storageAvailable}
            className={`${BUTTON} self-start`}
          >
            {sending ? copy.replying : copy.reply}
          </button>
        </form>
      )}
    </article>
  );
}
