import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import { formatAlmatyDateTime } from '@/lib/format-almaty';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authorizedFetch } from '@/lib/api/authorized';
import { listTopics } from '@/lib/api/public';
import type { components } from '@/lib/api/generated';

type ClientDetail = components['schemas']['ClientDetailDto'];

export default async function ClientPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const copy = locale === 'kz' ? kz.expertRecords : ru.expertRecords;
  const statusCopy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const statusLabels: Record<string, string> = {
    SCHEDULED: statusCopy.statusScheduled,
    ACTIVE: statusCopy.statusActive,
    COMPLETED: statusCopy.statusCompleted,
    CANCELLED: statusCopy.statusCancelled,
  };
  const [client, topics] = await Promise.all([
    authorizedFetch<ClientDetail>(`experts/me/clients/${id}`),
    listTopics(locale === 'kz' ? 'kz' : 'ru'),
  ]);
  if (!client) notFound();

  const topicNames = new Map(topics.map((t) => [t.slug, t.name]));

  return (
    <>
      <Link
        href={`/${locale}/expert/clients`}
        className="mb-6 inline-block text-sm font-bold text-primary"
      >
        {copy.allClients}
      </Link>

      <h1 className="mb-1 text-2xl font-extrabold text-ink">
        {client.displayName}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {client.consultations} {copy.meetings}
      </p>

      <ul className="flex flex-col gap-3">
        {client.history.map((item) => (
          <li
            key={item.id}
            className="rounded-[20px] border border-border bg-white p-5"
          >
            <p className="mb-1 text-sm font-bold text-ink">
              {topicNames.get(item.topicSlug) ?? item.topicSlug}
            </p>
            <p className="mb-2 text-xs text-faint">
              {item.startedAt
                ? formatAlmatyDateTime(item.startedAt, locale)
                : ''}{' '}
              · {statusLabels[item.status] ?? item.status}
            </p>
            {/* Текст заметки живёт в самой консультации: он зашифрован, и
                читать его пачкой в карточке значило бы продублировать путь
                чтения вместе с правилами доступа. */}
            <Link
              href={`/${locale}/expert/consultations/${item.id}`}
              className="text-sm font-bold text-primary"
            >
              {item.hasNote ? copy.openMeetingNote : copy.openMeeting}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
