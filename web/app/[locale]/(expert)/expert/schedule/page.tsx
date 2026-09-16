import { authorizedFetch } from '@/lib/api/authorized';
import WeekSchedule from '@/components/expert-cabinet/WeekSchedule';
import type { components } from '@/lib/api/generated';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type ScheduleResponse = components['schemas']['ScheduleResponseDto'];
type Day = components['schemas']['ScheduleDayDto'];

// Бэкенд может вернуть не все дни (эксперт заполнил не всю неделю), а
// редактор должен показывать неделю целиком — иначе выключенный день
// невозможно включить.
function fillWeek(days: Day[]): Day[] {
  const byWeekday = new Map(days.map((day) => [day.weekday, day]));

  return Array.from({ length: 7 }, (_, weekday) => {
    const existing = byWeekday.get(weekday);
    if (existing) return existing;
    return {
      weekday,
      enabled: false,
      startMin: 540,
      endMin: 1080,
      breakStart: null,
      breakEnd: null,
    } as Day;
  });
}

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const schedule = await authorizedFetch<ScheduleResponse>(
    'experts/me/schedule',
  );

  return (
    <>
      <h1 className="mb-2 text-2xl font-extrabold text-ink">
        {copy.scheduleTitle}
      </h1>
      <p className="mb-6 text-sm text-muted">{copy.scheduleHint}</p>
      {schedule ? (
        <WeekSchedule initial={fillWeek(schedule.days)} locale={locale} />
      ) : (
        <p
          role="alert"
          className="rounded-2xl border border-border bg-white p-6 text-body"
        >
          {copy.scheduleLoadError}
        </p>
      )}
    </>
  );
}
