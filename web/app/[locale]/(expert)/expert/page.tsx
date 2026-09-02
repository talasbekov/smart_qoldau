import { authorizedFetch } from '@/lib/api/authorized';
import DashboardStats, { todayStats } from '@/components/expert-cabinet/DashboardStats';
import type { components } from '@/lib/api/generated';

type ExpertConsultation = components['schemas']['ConsultationExpertDto'];
type Balance = components['schemas']['BalanceDto'];
type Reviews = components['schemas']['ExpertReviewsDto'];
type ExpertMe = components['schemas']['ExpertMeDto'];

export default async function ExpertHomePage() {
  // Три независимых запроса параллельно: дашборд не должен ждать
  // последовательно то, что можно получить сразу.
  const [me, consultations, balance, reviews] = await Promise.all([
    authorizedFetch<ExpertMe>('experts/me'),
    authorizedFetch<ExpertConsultation[]>('consultations'),
    authorizedFetch<Balance>('experts/me/balance'),
    authorizedFetch<Reviews>('experts/me/reviews?take=1'),
  ]);

  return (
    <DashboardStats
      name={me?.displayName ?? ''}
      stats={todayStats(consultations ?? [], new Date())}
      balanceTiyn={balance?.availableTiyn ?? 0}
      rating={reviews?.ratingAvg ?? 0}
      reviews={reviews?.ratingCount ?? 0}
    />
  );
}
