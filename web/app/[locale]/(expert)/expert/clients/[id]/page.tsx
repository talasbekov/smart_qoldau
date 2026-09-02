import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authorizedFetch } from '@/lib/api/authorized';
import { listTopics } from '@/lib/api/public';
import type { components } from '@/lib/api/generated';

type ClientDetail = components['schemas']['ClientDetailDto'];

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Запланирована',
  ACTIVE: 'Идёт сейчас',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ru-KZ', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ClientPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [client, topics] = await Promise.all([
    authorizedFetch<ClientDetail>(`experts/me/clients/${id}`),
    listTopics(),
  ]);
  if (!client) notFound();

  const topicNames = new Map(topics.map((t) => [t.slug, t.name]));

  return (
    <>
      <Link
        href={`/${locale}/expert/clients`}
        className="mb-6 inline-block text-sm font-bold text-primary"
      >
        ← Все клиенты
      </Link>

      <h1 className="mb-1 text-2xl font-extrabold text-ink">{client.displayName}</h1>
      <p className="mb-6 text-sm text-muted">{client.consultations} встреч</p>

      <ul className="flex flex-col gap-3">
        {client.history.map((item) => (
          <li key={item.id} className="rounded-[20px] border border-border bg-white p-5">
            <p className="mb-1 text-sm font-bold text-ink">
              {topicNames.get(item.topicSlug) ?? item.topicSlug}
            </p>
            <p className="mb-2 text-xs text-faint">
              {when(item.startedAt as string | null)} ·{' '}
              {STATUS_LABELS[item.status] ?? item.status}
            </p>
            {/* Текст заметки живёт в самой консультации: он зашифрован, и
                читать его пачкой в карточке значило бы продублировать путь
                чтения вместе с правилами доступа. */}
            <Link
              href={`/${locale}/expert/consultations/${item.id}`}
              className="text-sm font-bold text-primary"
            >
              {item.hasNote ? 'Открыть встречу и заметку' : 'Открыть встречу'}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
