import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import type { components } from '@/lib/api/generated';

type Day = components['schemas']['DailyEarningDto'];

// Р-02: платформа удерживает 15 % полной цены. Называем это прямо —
// иначе разница между ценой в каталоге и приходом выглядит ошибкой.
const COMMISSION_LABEL = '15%';

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

export default function EarningsSummary({
  days,
  balanceTiyn,
  availableTiyn,
  locale = 'ru',
}: {
  days: Day[];
  balanceTiyn: number;
  availableTiyn: number;
  locale?: string;
}) {
  const copy = locale === 'kz' ? kz.expertRecords : ru.expertRecords;
  const total = days.reduce((sum, day) => sum + day.amountTiyn, 0);
  const consultations = days.reduce((sum, day) => sum + day.consultations, 0);
  // Средний чек — по консультациям, а не по дням: делить доход на дни,
  // включая выходные, значит показывать неправду.
  const average = consultations > 0 ? Math.round(total / consultations) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Tile label={copy.periodIncome} value={tenge(total, locale)} />
        <Tile label={copy.consultationCount} value={String(consultations)} />
        <Tile label={copy.averageCheck} value={tenge(average, locale)} />
        <Tile label={copy.commission} value={COMMISSION_LABEL} />
        <Tile label={copy.available} value={tenge(availableTiyn, locale)} />
        <Tile label={copy.balance} value={tenge(balanceTiyn, locale)} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-extrabold text-ink">
          {copy.dailyIncome}
        </h2>
        {/* Таблица, а не карточки: на широком экране числа сравниваются
            по столбцу, а карточки заставляют читать по одной. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted">
                <th scope="col" className="py-2 pr-4">
                  {copy.date}
                </th>
                <th scope="col" className="py-2 pr-4">
                  {copy.consultationCount}
                </th>
                <th scope="col" className="py-2">
                  {copy.earningsTitle}
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date} className="border-b border-border">
                  <td className="py-2 pr-4 text-ink">
                    {new Date(day.date).toLocaleDateString(
                      locale === 'kz' ? 'kk-KZ' : 'ru-KZ',
                      {
                        timeZone: 'Asia/Almaty',
                        day: 'numeric',
                        month: 'long',
                      },
                    )}
                  </td>
                  <td className="py-2 pr-4 text-body">{day.consultations}</td>
                  <td className="py-2 font-semibold text-ink">
                    {tenge(day.amountTiyn, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
