'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { components } from '@/lib/api/generated';
import type { Topic } from '@/lib/api/public';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type ExpertConsultation = components['schemas']['ConsultationExpertDto'];

const COMMISSION = 0.15;
const STATUS_REFRESH_MS = 30_000;

function tenge(tiyn: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === 'kz' ? 'kk-KZ' : 'ru-KZ').format(Math.round(tiyn / 100))} ₸`;
}

function when(iso: string | null, locale: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(locale === 'kz' ? 'kk-KZ' : 'ru-KZ', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Almaty',
  });
}

function Card({
  item,
  topicNames,
  locale,
}: {
  item: ExpertConsultation;
  topicNames: Map<string, string>;
  locale: string;
}) {
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const formatLabels: Record<string, string> = {
    chat: copy.formatChat,
    audio: copy.formatAudio,
    video: copy.formatVideo,
  };
  const statusLabels: Record<string, string> = {
    SCHEDULED: copy.statusScheduled,
    ACTIVE: copy.statusActive,
    COMPLETED: copy.statusCompleted,
    CANCELLED: copy.statusCancelled,
  };

  return (
    <li className="rounded-[20px] border border-border bg-white p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-extrabold text-ink">
          {topicNames.get(item.topicSlug) ?? item.topicSlug}
        </span>
        {item.isEmergency ? (
          <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold text-ink">
            {copy.offersEmergency}
          </span>
        ) : null}
      </div>
      <p className="mb-2 text-xs text-faint">
        {copy.offersClient.replace('{code}', String(item.clientCode))} ·{' '}
        {formatLabels[item.format] ?? item.format} ·{' '}
        {when(item.startedAt, locale)}
      </p>
      <p className="mb-3 text-sm font-semibold text-ink">
        {statusLabels[item.status] ?? item.status} ·{' '}
        {tenge(Math.round(item.priceTiyn * (1 - COMMISSION)), locale)}
      </p>
      <Link
        href={`/${locale}/expert/consultations/${item.id}`}
        className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {item.status === 'ACTIVE' ? copy.openSession : copy.openConsultation}
      </Link>
    </li>
  );
}

function Section({
  title,
  items,
  topicNames,
  locale,
}: {
  title: string;
  items: ExpertConsultation[];
  topicNames: Map<string, string>;
  locale: string;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-extrabold text-ink">{title}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <Card
            key={item.id}
            item={item}
            topicNames={topicNames}
            locale={locale}
          />
        ))}
      </ul>
    </section>
  );
}

export default function ExpertConsultationList({
  items,
  topics,
  locale,
}: {
  items: ExpertConsultation[];
  topics: Topic[];
  locale: string;
}) {
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const router = useRouter();
  const hasLiveStatus = items.some(
    (item) => item.status === 'SCHEDULED' || item.status === 'ACTIVE',
  );

  useEffect(() => {
    if (!hasLiveStatus) return;
    const timer = setInterval(() => router.refresh(), STATUS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasLiveStatus, router]);

  if (items.length === 0) {
    return <p className="py-12 text-body">{copy.consultationsEmpty}</p>;
  }

  const topicNames = new Map(topics.map((topic) => [topic.slug, topic.name]));
  const current = items.filter((item) => item.status === 'ACTIVE');
  const scheduled = items.filter((item) => item.status === 'SCHEDULED');
  const past = items.filter(
    (item) => item.status === 'COMPLETED' || item.status === 'CANCELLED',
  );

  return (
    <div className="flex flex-col gap-8">
      <Section
        title={copy.currentConsultations}
        items={current}
        topicNames={topicNames}
        locale={locale}
      />
      <Section
        title={copy.scheduledConsultations}
        items={scheduled}
        topicNames={topicNames}
        locale={locale}
      />
      <Section
        title={copy.pastConsultations}
        items={past}
        topicNames={topicNames}
        locale={locale}
      />
    </div>
  );
}
