'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api/client';
import { connectRealtime, type SqSocket } from '@/lib/realtime/socket';
import type { Topic } from '@/lib/api/public';
import type { components } from '@/lib/api/generated';
import { deskCopy } from '@/components/expert-desk/copy';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type Offer = components['schemas']['OfferDto'];
type Accepted = components['schemas']['AcceptOfferDto'];
type Notice = { kind: 'status' | 'alert'; text: string };

// A route transition can briefly overlap two lists. Never submit the same
// offer twice from this document; the backend arbitrates between tabs.
const pendingOffers = new Set<string>();

const DEFINITIVE_OFFER_ERRORS = new Set([
  'OFFER_NOT_FOUND',
  'OFFER_EXPIRED',
  'OFFER_ALREADY_TAKEN',
]);

export default function OfferList({
  initial,
  topics,
  locale,
  hideEmpty = false,
}: {
  initial: Offer[];
  topics: Topic[];
  locale: string;
  hideEmpty?: boolean;
}) {
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const router = useRouter();
  const desk = deskCopy(locale);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [offers, setOffers] = useState(initial);
  const [busy, setBusy] = useState<{
    id: string;
    action: 'accept' | 'decline';
  } | null>(null);
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const mounted = useRef(true);
  const actionLock = useRef(false);
  const eventRevision = useRef(0);
  const syncing = useRef(false);
  const syncRequested = useRef(false);
  const topicNames = new Map(topics.map((topic) => [topic.slug, topic.name]));
  const formatLabels: Record<string, string> = {
    chat: copy.formatChat,
    audio: copy.formatAudio,
    video: copy.formatVideo,
  };

  const resync = useCallback(async () => {
    if (syncing.current) {
      syncRequested.current = true;
      return;
    }

    syncing.current = true;
    try {
      do {
        syncRequested.current = false;
        const revision = eventRevision.current;
        try {
          const fresh = await apiFetch<Offer[]>('experts/me/offers');
          if (!mounted.current) return;
          if (eventRevision.current === revision && fresh) {
            setOffers(fresh);
            setNotice(null);
            window.dispatchEvent(new Event('sq:expert-work-status-sync'));
          } else if (eventRevision.current !== revision) {
            // An event raced with REST. Run one more snapshot after the
            // event so a stale response can neither resurrect nor drop it.
            syncRequested.current = true;
          }
        } catch {
          if (mounted.current) {
            setNotice({ kind: 'alert', text: copy.offersSyncError });
          }
        }
      } while (syncRequested.current && mounted.current);
    } finally {
      syncing.current = false;
    }
  }, [copy.offersSyncError]);

  useEffect(() => {
    mounted.current = true;
    let socket: SqSocket | null = null;
    let dropped = false;

    void (async () => {
      try {
        const connected = await connectRealtime();
        if (dropped) {
          connected.close();
          return;
        }
        socket = connected;

        connected.on('offer.new', (payload) => {
          eventRevision.current += 1;
          const offer = payload as Offer;
          setOffers((current) =>
            current.some((item) => item.offerId === offer.offerId)
              ? current
              : [offer, ...current],
          );
        });
        connected.on('offer.revoked', (payload) => {
          eventRevision.current += 1;
          const { offerId } = payload as { offerId: string };
          setOffers((current) =>
            current.filter((item) => item.offerId !== offerId),
          );
          setBlocked((current) => {
            const next = new Set(current);
            next.delete(offerId);
            return next;
          });
        });
        connected.onReady(() => {
          void resync();
        });
      } catch {
        if (mounted.current) {
          setNotice({ kind: 'alert', text: copy.offersSyncError });
        }
      }
    })();

    void resync();
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void resync();
    }, 15_000);
    return () => {
      clearInterval(poll);
      mounted.current = false;
      dropped = true;
      socket?.close();
    };
  }, [copy.offersSyncError, resync]);

  function removeOffer(offerId: string) {
    eventRevision.current += 1;
    setOffers((current) =>
      current.filter((offer) => offer.offerId !== offerId),
    );
    setBlocked((current) => {
      const next = new Set(current);
      next.delete(offerId);
      return next;
    });
  }

  function isDefinitive(caught: unknown): boolean {
    return (
      caught instanceof ApiError &&
      caught.code !== null &&
      DEFINITIVE_OFFER_ERRORS.has(caught.code)
    );
  }

  async function accept(offerId: string) {
    if (
      actionLock.current ||
      pendingOffers.has(offerId) ||
      blocked.has(offerId)
    )
      return;
    pendingOffers.add(offerId);
    actionLock.current = true;
    // Any REST snapshot already in flight predates this mutation. It may be
    // applied only after a fresh follow-up snapshot, and it must never clear
    // an unknown outcome.
    eventRevision.current += 1;
    setBusy({ id: offerId, action: 'accept' });
    setNotice(null);
    try {
      const result = await apiFetch<Accepted>(`offers/${offerId}/accept`, {
        method: 'POST',
      });
      if (!result?.consultationId) throw new TypeError('accept result missing');
      if (mounted.current) {
        removeOffer(offerId);
        window.dispatchEvent(
          new CustomEvent('sq:expert-work-status', { detail: 'BUSY' }),
        );
        router.push(`/${locale}/expert/consultations/${result.consultationId}`);
      }
    } catch (caught) {
      if (!mounted.current) return;
      if (isDefinitive(caught)) {
        removeOffer(offerId);
        setNotice({ kind: 'status', text: copy.offerUnavailable });
      } else {
        setBlocked((current) => new Set(current).add(offerId));
      }
    } finally {
      pendingOffers.delete(offerId);
      actionLock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  async function decline(offerId: string) {
    if (
      actionLock.current ||
      pendingOffers.has(offerId) ||
      blocked.has(offerId)
    )
      return;
    pendingOffers.add(offerId);
    actionLock.current = true;
    eventRevision.current += 1;
    setBusy({ id: offerId, action: 'decline' });
    setNotice(null);
    try {
      await apiFetch(`offers/${offerId}/decline`, { method: 'POST' });
      if (mounted.current) removeOffer(offerId);
    } catch (caught) {
      if (!mounted.current) return;
      if (isDefinitive(caught)) {
        removeOffer(offerId);
        setNotice({ kind: 'status', text: copy.offerUnavailable });
      } else {
        setBlocked((current) => new Set(current).add(offerId));
      }
    } finally {
      pendingOffers.delete(offerId);
      actionLock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {hideEmpty && offers.length > 0 ? (
        <h2 role="status" className="text-lg font-extrabold text-ink">
          {desk.incoming}: {offers.length}
        </h2>
      ) : null}
      {blocked.size > 0 ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-ink"
        >
          <p>{copy.offerUnknown}</p>
          <Link
            href={`/${locale}/expert/consultations`}
            className="mt-2 inline-flex min-h-11 items-center font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {copy.navConsultations}
          </Link>
        </div>
      ) : null}

      {notice ? (
        <div
          role={notice.kind}
          className={`rounded-2xl border p-4 text-sm ${
            notice.kind === 'alert'
              ? 'border-red-200 bg-red-50 text-ink'
              : 'border-border bg-white text-body'
          }`}
        >
          <p>{notice.text}</p>
          {notice.kind === 'alert' ? (
            <button
              type="button"
              onClick={() => void resync()}
              className="min-h-11 font-bold text-primary"
            >
              {desk.retry}
            </button>
          ) : null}
          {notice.kind === 'alert' ? (
            <Link
              href={`/${locale}/expert/consultations`}
              className="mt-2 inline-flex min-h-11 items-center font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {copy.navConsultations}
            </Link>
          ) : null}
        </div>
      ) : null}

      {offers.length === 0 ? (
        hideEmpty ? null : (
          <p className="py-8 text-body">{copy.offersEmpty}</p>
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {offers.map((offer) => {
            const remaining =
              now === null
                ? null
                : Math.max(
                    0,
                    Math.ceil(
                      (new Date(offer.deadlineAt).getTime() - now) / 1000,
                    ),
                  );
            const expired =
              remaining !== null &&
              (!Number.isFinite(remaining) || remaining <= 0);
            const actionBlocked = busy !== null || blocked.has(offer.offerId);

            return (
              <li
                key={offer.offerId}
                className="rounded-[20px] border border-border bg-white p-5"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-extrabold text-ink">
                    {topicNames.get(offer.topicSlug) ?? offer.topicSlug}
                  </span>
                  {offer.isEmergency ? (
                    <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold text-ink">
                      {copy.offersEmergency}
                    </span>
                  ) : null}
                </div>
                <p className="mb-3 text-xs text-faint">
                  {copy.offersClient.replace(
                    '{code}',
                    String(offer.clientCode),
                  )}{' '}
                  · {formatLabels[offer.format] ?? offer.format}
                </p>

                <p className="mb-3 text-sm font-bold text-ink">
                  {desk.remaining}: {remaining === null ? '…' : remaining}{' '}
                  {desk.seconds}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => accept(offer.offerId)}
                    disabled={expired || actionBlocked}
                    className="min-h-11 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    {busy?.id === offer.offerId && busy.action === 'accept'
                      ? copy.acceptingOffer
                      : copy.acceptOffer}
                  </button>
                  <button
                    type="button"
                    onClick={() => decline(offer.offerId)}
                    disabled={expired || actionBlocked}
                    className="min-h-11 rounded-2xl border border-border px-5 py-3 text-sm font-bold text-ink disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {busy?.id === offer.offerId && busy.action === 'decline'
                      ? copy.decliningOffer
                      : copy.declineOffer}
                  </button>
                </div>
                {expired ? (
                  <p className="mt-2 text-xs text-muted">{copy.offerExpired}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
