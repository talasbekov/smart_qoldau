'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import { connectRealtime, type SqSocket } from '@/lib/realtime/socket';
import type { Topic } from '@/lib/api/public';
import type { components } from '@/lib/api/generated';

type Offer = components['schemas']['OfferDto'];
type Accepted = components['schemas']['AcceptOfferDto'];

const FORMAT_LABELS: Record<string, string> = { chat: 'Чат', audio: 'Аудио', video: 'Видео' };

export default function OfferList({
  initial,
  topics,
  locale,
}: {
  initial: Offer[];
  topics: Topic[];
  locale: string;
}) {
  const router = useRouter();
  const [offers, setOffers] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const topicNames = new Map(topics.map((t) => [t.slug, t.name]));

  useEffect(() => {
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
          const offer = payload as Offer;
          setOffers((current) =>
            current.some((o) => o.offerId === offer.offerId) ? current : [offer, ...current],
          );
        });
        // Заявку мог забрать другой эксперт. Оставить её на экране —
        // значит дать нажать «принять» и получить ошибку.
        connected.on('offer.revoked', (payload) => {
          const { offerId } = payload as { offerId: string };
          setOffers((current) => current.filter((o) => o.offerId !== offerId));
        });
      } catch {
        // Без сокета список остаётся тем, что пришёл с сервера.
      }
    })();

    return () => {
      dropped = true;
      socket?.close();
    };
  }, []);

  async function accept(offerId: string) {
    setBusy(offerId);
    try {
      const result = await apiFetch<Accepted>(`offers/${offerId}/accept`, { method: 'POST' });
      if (result?.consultationId) {
        router.push(`/${locale}/expert/consultations/${result.consultationId}`);
        return;
      }
    } catch {
      // Заявку успели забрать — она просто уходит из списка.
    }
    setOffers((current) => current.filter((o) => o.offerId !== offerId));
    setBusy(null);
  }

  async function decline(offerId: string) {
    setBusy(offerId);
    await apiFetch(`offers/${offerId}/decline`, { method: 'POST' }).catch(() => null);
    setOffers((current) => current.filter((o) => o.offerId !== offerId));
    setBusy(null);
  }

  if (offers.length === 0) {
    return <p className="py-12 text-body">Новых заявок нет</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {offers.map((offer) => {
        const expired = new Date(offer.deadlineAt).getTime() <= Date.now();

        return (
          <li key={offer.offerId} className="rounded-[20px] border border-border bg-white p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-extrabold text-ink">
                {topicNames.get(offer.topicSlug) ?? offer.topicSlug}
              </span>
              {offer.isEmergency && (
                <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold text-ink">
                  ⚠ Экстренно
                </span>
              )}
            </div>
            {/* Код клиента, а не имя: до консультации эксперт не знает,
                кто перед ним — PII-инвариант продукта. */}
            <p className="mb-3 text-xs text-faint">
              Клиент №{offer.clientCode} · {FORMAT_LABELS[offer.format] ?? offer.format}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => accept(offer.offerId)}
                disabled={expired || busy === offer.offerId}
                className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Принять
              </button>
              <button
                type="button"
                onClick={() => decline(offer.offerId)}
                disabled={busy === offer.offerId}
                className="rounded-2xl border border-border px-5 py-3 text-sm font-bold text-ink disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                Отклонить
              </button>
            </div>
            {expired && <p className="mt-2 text-xs text-muted">Срок ответа истёк</p>}
          </li>
        );
      })}
    </ul>
  );
}
