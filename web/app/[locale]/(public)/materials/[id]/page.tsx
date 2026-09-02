import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';
import { getContentItem } from '@/lib/api/public';
import { resolveSiteUrl } from '@/lib/auth/site-url';

const SITE_URL = resolveSiteUrl({
  ...process.env,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://smartqoldau.kz',
});

function apiLocale(locale: string): string {
  return locale === 'kz' ? 'kk' : 'ru';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const item = await getContentItem(id, apiLocale(locale));
  if (!item) return { title: 'Материал не найден' };

  return {
    title: item.title,
    description: item.summary ?? undefined,
    alternates: {
      canonical: `${SITE_URL}/${locale}/materials/${id}`,
      languages: {
        ru: `${SITE_URL}/ru/materials/${id}`,
        kk: `${SITE_URL}/kz/materials/${id}`,
      },
    },
  };
}

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const item = await getContentItem(id, apiLocale(locale));
  if (!item) notFound();

  return (
    <main className="mx-auto max-w-[720px] px-8 pb-16 pt-11">
      <Link href="/materials" className="mb-6 inline-block text-sm font-bold text-primary">
        ← Все материалы
      </Link>

      <h1 className="mb-2 text-3xl font-extrabold text-ink">{item.title}</h1>
      {item.summary && <p className="mb-6 text-body">{item.summary}</p>}

      {item.locked ? (
        // Тела платного материала здесь нет и быть не может: бэкенд его не
        // отдаёт без подписки. Показываем, что за пейволлом, и путь к нему.
        <section className="rounded-[20px] bg-chip p-6">
          <p className="mb-3 text-sm font-bold text-ink">Материал доступен по подписке</p>
          <p className="mb-4 text-sm text-body">
            Premium открывает все практики и даёт скидку на консультации.
          </p>
          <Link
            href="/premium"
            className="inline-block rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Что входит в Premium
          </Link>
        </section>
      ) : (
        item.body?.markdown && (
          <article className="whitespace-pre-line text-base leading-relaxed text-body">
            {item.body.markdown}
          </article>
        )
      )}
    </main>
  );
}
