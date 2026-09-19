import DeskRefresh from '@/components/expert-desk/DeskRefresh';
import Link from 'next/link';
import { listTopics } from '@/lib/api/public';
import OfferList from '@/components/expert-cabinet/OfferList';
import ExpertConsultationList from '@/components/expert-cabinet/ExpertConsultationList';
import { deskCopy } from '@/components/expert-desk/copy';
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

// The API sorts descending, so a single page could omit the nearest booking.
async function loadLive(
  status: 'ACTIVE' | 'SCHEDULED',
): Promise<ExpertConsultation[] | null> {
  const items: ExpertConsultation[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await authorizedFetch<ExpertConsultation[]>(
      `consultations?as=expert&status=${status}&take=100&skip=${skip}`,
    );
    if (!page) return null;
    items.push(...page);
    if (page.length < 100) return items;
  }
}

export default async function ExpertHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const [
    me,
    consultations,
    balance,
    reviews,
    offers,
    topics,
    active,
    scheduled,
  ] = await Promise.all([
    authorizedFetch<ExpertMe>('experts/me'),
    authorizedFetch<ExpertConsultation[]>('consultations?as=expert'),
    authorizedFetch<Balance>('experts/me/balance'),
    authorizedFetch<Reviews>('experts/me/reviews?take=1'),
    authorizedFetch<components['schemas']['OfferDto'][]>('experts/me/offers'),
    listTopics(locale === 'kz' ? 'kz' : 'ru'),
    loadLive('ACTIVE'),
    loadLive('SCHEDULED'),
  ]);

  const desk = deskCopy(locale);
  const live = [
    ...(active ?? []),
    ...(scheduled ?? [])
      .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''))
      .slice(0, 5),
  ];
  return (
    <div className="flex flex-col gap-8">
      <DeskRefresh />
      {me && consultations && balance && reviews ? (
        <DashboardStats
          name={me.displayName}
          stats={todayStats(consultations, new Date())}
          balanceTiyn={balance.availableTiyn}
          rating={reviews.ratingAvg}
          reviews={reviews.ratingCount}
          locale={locale}
        />
      ) : (
        <p role="alert">{copy.dashboardLoadError}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${locale}/expert/schedule`}
          className="inline-flex min-h-11 items-center rounded-xl bg-chip px-4 font-bold text-primary"
        >
          {desk.schedule}
        </Link>
        <Link
          href={`/${locale}/expert/profile`}
          className="inline-flex min-h-11 items-center px-4 font-bold text-primary"
        >
          {desk.profile}
        </Link>
      </div>
      <section aria-labelledby="desk-incoming">
        <h2 id="desk-incoming" className="mb-3 text-lg font-extrabold text-ink">
          {desk.incoming}
        </h2>
        {!offers ? <p role="alert">{copy.offersSyncError}</p> : null}
        <OfferList initial={offers ?? []} topics={topics} locale={locale} />
      </section>
      <section aria-labelledby="desk-consultations">
        <h2
          id="desk-consultations"
          className="mb-3 text-lg font-extrabold text-ink"
        >
          {desk.live}
        </h2>
        {!active || !scheduled ? (
          <p role="alert">{copy.dashboardLoadError}</p>
        ) : live.length ? (
          <ExpertConsultationList
            items={live}
            topics={topics}
            locale={locale}
          />
        ) : (
          <p className="text-body">{desk.emptyLive}</p>
        )}
        <Link
          href={`/${locale}/expert/consultations`}
          className="mt-3 inline-flex min-h-11 items-center font-bold text-primary"
        >
          {desk.openConsultations}
        </Link>
      </section>
    </div>
  );
}
