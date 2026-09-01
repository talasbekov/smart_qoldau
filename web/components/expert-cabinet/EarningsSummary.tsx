import type { components } from '@/lib/api/generated';

type Day = components['schemas']['DailyEarningDto'];

// Р-02: платформа удерживает 15 % полной цены. Называем это прямо —
// иначе разница между ценой в каталоге и приходом выглядит ошибкой.
const COMMISSION_LABEL = '15%';

function tenge(tiyn: number): string {
  return `${new Intl.NumberFormat('ru-KZ').format(Math.round(tiyn / 100))} ₸`;
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
}: {
  days: Day[];
  balanceTiyn: number;
  availableTiyn: number;
}) {
  const total = days.reduce((sum, day) => sum + day.amountTiyn, 0);
  const consultations = days.reduce((sum, day) => sum + day.consultations, 0);
  // Средний чек — по консультациям, а не по дням: делить доход на дни,
  // включая выходные, значит показывать неправду.
  const average = consultations > 0 ? Math.round(total / consultations) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Tile label="Доход за период" value={tenge(total)} />
        <Tile label="Консультаций" value={String(consultations)} />
        <Tile label="Средний чек" value={tenge(average)} />
        <Tile label="Комиссия платформы" value={COMMISSION_LABEL} />
        <Tile label="Доступно к выводу" value={tenge(availableTiyn)} />
        <Tile label="Баланс" value={tenge(balanceTiyn)} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-extrabold text-ink">Доход по дням</h2>
        {/* Таблица, а не карточки: на широком экране числа сравниваются
            по столбцу, а карточки заставляют читать по одной. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted">
                <th scope="col" className="py-2 pr-4">Дата</th>
                <th scope="col" className="py-2 pr-4">Консультаций</th>
                <th scope="col" className="py-2">Доход</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date} className="border-b border-border">
                  <td className="py-2 pr-4 text-ink">
                    {new Date(day.date).toLocaleDateString('ru-KZ', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </td>
                  <td className="py-2 pr-4 text-body">{day.consultations}</td>
                  <td className="py-2 font-semibold text-ink">{tenge(day.amountTiyn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
