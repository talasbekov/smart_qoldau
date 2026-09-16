import { authorizedFetch } from '@/lib/api/authorized';
import { listTopics } from '@/lib/api/public';
import OfferList from '@/components/expert-cabinet/OfferList';
import type { components } from '@/lib/api/generated';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type Offer = components['schemas']['OfferDto'];

export default async function OffersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const [offers, topics] = await Promise.all([
    authorizedFetch<Offer[]>('experts/me/offers'),
    listTopics(locale === 'kz' ? 'kz' : 'ru'),
  ]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">
        {copy.offersTitle}
      </h1>
      {offers ? (
        <OfferList initial={offers} topics={topics} locale={locale} />
      ) : (
        <p
          role="alert"
          className="rounded-2xl border border-border bg-white p-6 text-body"
        >
          {copy.offersSyncError}
        </p>
      )}
    </>
  );
}
