import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import Link from 'next/link';
import { authorizedFetch } from '@/lib/api/authorized';
import type { ExpertPublic } from '@/lib/api/public';
import ExpertAvatar from '@/components/expert/ExpertAvatar';

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.favorites : ru.favorites;
  const experts = (await authorizedFetch<ExpertPublic[]>('favorites')) ?? [];

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">{copy.title}</h1>

      {experts.length === 0 ? (
        <div className="py-12">
          <p className="mb-4 text-body">{copy.empty}</p>
          <Link
            href={`/${locale}/catalog`}
            className="inline-block rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {copy.catalog}
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {experts.map((expert) => (
            <li
              key={expert.id}
              className="rounded-[20px] border border-border bg-white p-5"
            >
              <div className="mb-3 flex items-center gap-3">
                <ExpertAvatar photoUrl={expert.photoUrl} size={48} />
                <Link
                  href={`/${locale}/experts/${expert.id}`}
                  className="text-[15px] font-extrabold text-ink hover:underline"
                >
                  {expert.displayName}
                </Link>
              </div>
              <p className="text-xs text-faint">{expert.city}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
