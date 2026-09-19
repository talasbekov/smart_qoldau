import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import Link from 'next/link';
import type { components } from '@/lib/api/generated';

type Client = components['schemas']['ClientCardDto'];

function when(iso: string | null, locale: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(locale === 'kz' ? 'kk-KZ' : 'ru-KZ', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Almaty',
  });
}

export default function ClientList({
  items,
  locale,
}: {
  items: Client[];
  locale: string;
}) {
  const copy = locale === 'kz' ? kz.expertRecords : ru.expertRecords;
  if (items.length === 0) {
    return <p className="py-12 max-w-xl text-body">{copy.clientsEmpty}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((client) => (
        <li
          key={client.id}
          className="rounded-[20px] border border-border bg-white p-5"
        >
          <h2 className="text-[15px] font-extrabold text-ink">
            <Link
              href={`/${locale}/expert/clients/${client.id}`}
              className="hover:underline"
            >
              {client.displayName}
            </Link>
          </h2>
          <p className="text-xs text-faint">
            {client.consultations} {copy.meetings} · {copy.lastMeeting}{' '}
            {when(client.lastAt as string | null, locale)}
          </p>
        </li>
      ))}
    </ul>
  );
}
