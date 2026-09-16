import { authorizedFetch } from '@/lib/api/authorized';
import DashboardStats, {
  todayStats,
} from '@/components/expert-cabinet/DashboardStats';
import type { components } from '@/lib/api/generated';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type ExpertConsultation = components['schemas']['ConsultationExpertDto'];
type Balance = components['schemas']['BalanceDto'];
type Reviews = components['schemas']['ExpertReviewsDto'];
type ExpertMe = components['schemas']['ExpertMeDto'];

export default async function ExpertHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  // Четыре независимых запроса параллельно: дашборд не должен ждать
  // последовательно то, что можно получить сразу.
  const [me, consultations, balance, reviews] = await Promise.all([
    authorizedFetch<ExpertMe>('experts/me'),
    authorizedFetch<ExpertConsultation[]>('consultations?as=expert'),
    authorizedFetch<Balance>('experts/me/balance'),
    authorizedFetch<Reviews>('experts/me/reviews?take=1'),
  ]);

  if (!me || !consultations || !balance || !reviews) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-border bg-white p-6 text-body"
      >
        {copy.dashboardLoadError}
      </p>
    );
  }

  return (
    <DashboardStats
      name={me.displayName}
      stats={todayStats(consultations, new Date())}
      balanceTiyn={balance.availableTiyn}
      rating={reviews.ratingAvg}
      reviews={reviews.ratingCount}
      locale={locale}
    />
  );
}
