import { authorizedFetch } from '@/lib/api/authorized';
import { listTopics } from '@/lib/api/public';
import OfferList from '@/components/expert-cabinet/OfferList';
import type { components } from '@/lib/api/generated';

type Offer = components['schemas']['OfferDto'];

export default async function OffersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [offers, topics] = await Promise.all([
    authorizedFetch<Offer[]>('experts/me/offers'),
    listTopics(),
  ]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Заявки</h1>
      <OfferList initial={offers ?? []} topics={topics} locale={locale} />
    </>
  );
}
