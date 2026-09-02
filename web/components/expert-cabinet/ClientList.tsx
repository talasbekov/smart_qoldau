import Link from 'next/link';
import type { components } from '@/lib/api/generated';

type Client = components['schemas']['ClientCardDto'];

function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-KZ', { day: 'numeric', month: 'long' });
}

export default function ClientList({
  items,
  locale,
}: {
  items: Client[];
  locale: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-12 max-w-xl text-body">
        Здесь появятся люди, с которыми вы работали и которые согласились, чтобы вы
        видели их имя и историю встреч. Те, кто согласия не дал, остаются под кодом
        клиента.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((client) => (
        <li key={client.id} className="rounded-[20px] border border-border bg-white p-5">
          <h2 className="text-[15px] font-extrabold text-ink">
            <Link href={`/${locale}/expert/clients/${client.id}`} className="hover:underline">
              {client.displayName}
            </Link>
          </h2>
          <p className="text-xs text-faint">
            {client.consultations} встреч · последняя {when(client.lastAt as string | null)}
          </p>
        </li>
      ))}
    </ul>
  );
}
