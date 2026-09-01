import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getExpert, getExpertReviews } from '@/lib/api/public';
import ExpertProfile from '@/components/expert/ExpertProfile';
import ExpertJsonLd from '@/components/expert/ExpertJsonLd';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://smartqoldau.kz';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const expert = await getExpert(id);
  if (!expert) return { title: 'Специалист не найден' };

  return {
    title: `${expert.displayName} — психолог, ${expert.city}`,
    description: `Консультация психолога ${expert.displayName}: чат, аудио или видео. ${expert.city}.`,
    alternates: {
      canonical: `${SITE_URL}/${locale}/experts/${id}`,
      // kk, а не kz: в hreflang ждут код языка, как и в атрибуте lang.
      languages: {
        ru: `${SITE_URL}/ru/experts/${id}`,
        kk: `${SITE_URL}/kz/experts/${id}`,
      },
    },
  };
}

export default async function ExpertPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const expert = await getExpert(id);
  if (!expert) notFound();

  // Отзывы запрашиваются после карточки намеренно: если их эндпоинт
  // отвалится, страница специалиста всё равно откроется.
  const reviews = await getExpertReviews(id);

  return (
    <main className="mx-auto max-w-[1240px] px-8 pb-16 pt-11">
      <ExpertJsonLd expert={expert} url={`${SITE_URL}/${locale}/experts/${id}`} />
      <ExpertProfile expert={expert} reviews={reviews} locale={locale} />
    </main>
  );
}
