import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import { authorizedFetch } from '@/lib/api/authorized';
import EarningsSummary from '@/components/expert-cabinet/EarningsSummary';
import type { components } from '@/lib/api/generated';

type Daily = components['schemas']['DailyEarningsDto'];
type Balance = components['schemas']['BalanceDto'];

export default async function EarningsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.expertRecords : ru.expertRecords;
  const [daily, balance] = await Promise.all([
    authorizedFetch<Daily>('experts/me/earnings/daily'),
    authorizedFetch<Balance>('experts/me/balance'),
  ]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">
        {copy.earningsTitle}
      </h1>
      <EarningsSummary
        locale={locale}
        days={daily?.days ?? []}
        balanceTiyn={balance?.balanceTiyn ?? 0}
        availableTiyn={balance?.availableTiyn ?? 0}
      />
    </>
  );
}
