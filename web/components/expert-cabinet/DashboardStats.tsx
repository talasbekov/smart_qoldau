import type { components } from '@/lib/api/generated';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type ExpertConsultation = components['schemas']['ConsultationExpertDto'];

export type TodayStats = { total: number; completed: number };

// Учёт в проекте ведётся по Алматы — день у эксперта тот же, что в
// начислениях и в сутках офферов.
const ALMATY = 'Asia/Almaty';

function almatyDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: ALMATY });
}

export function todayStats(items: ExpertConsultation[], now: Date): TodayStats {
  const today = now.toLocaleDateString('en-CA', { timeZone: ALMATY });
  const mine = items.filter(
    (item) => item.startedAt && almatyDay(item.startedAt) === today,
  );

  return {
    total: mine.length,
    // Отменённая не «завершена»: считать её выполненной работой значит
    // приукрашивать день.
    completed: mine.filter((item) => item.status === 'COMPLETED').length,
  };
}

function tenge(tiyn: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === 'kz' ? 'kk-KZ' : 'ru-KZ').format(Math.round(tiyn / 100))} ₸`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-border bg-white p-5">
      <p className="mb-1 text-xs font-semibold text-muted">{label}</p>
      <p className="text-2xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

export default function DashboardStats({
  name,
  stats,
  balanceTiyn,
  rating,
  reviews,
  locale = 'ru',
}: {
  name: string;
  stats: TodayStats;
  balanceTiyn: number;
  rating: number;
  reviews: number;
  locale?: string;
}) {
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const firstName = name.split(' ')[0];
  return (
    <>
      {/* Только имя: «Здравствуйте, Айгуль Смагулова» звучит как
          обращение из банка, а не как кабинет своего рабочего места. */}
      <h1 className="mb-1 text-2xl font-extrabold text-ink">
        {copy.dashboardGreeting.replace('{name}', firstName)}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {stats.total === 0
          ? copy.dashboardEmpty
          : copy.dashboardToday.replace('{count}', String(stats.total))}
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Tile label={copy.statToday} value={String(stats.total)} />
        <Tile label={copy.statCompleted} value={String(stats.completed)} />
        <Tile label={copy.statAvailable} value={tenge(balanceTiyn, locale)} />
        {/* Рейтинг без отзывов — не ноль, а его отсутствие: «0.0 ★»
            выглядит как плохая оценка, хотя оценок просто нет. */}
        {reviews > 0 && (
          <Tile
            label={copy.statRating}
            value={`${rating.toFixed(1)} ★ · ${reviews}`}
          />
        )}
      </div>
    </>
  );
}
