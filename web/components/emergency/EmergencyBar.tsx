import { getTranslations } from 'next-intl/server';

// Номера и формулировки взяты из мобильного экрана Р-16
// (app_client/lib/l10n) — выдумывать телефоны экстренных служб нельзя.
const HOTLINES = [
  { number: '150', key: 'hotline150' },
  { number: '103', key: 'hotline103' },
  { number: '112', key: 'hotline112' },
] as const;

// Полоса стоит НАД шапкой и на каждой публичной странице. Причина именно
// в вебе: в приложении человек приходит через главный экран, где
// дисклеймер есть, а в вебе он попадает из поиска сразу на профиль
// специалиста — и там до этого не было ничего. Прятать за раскрытие
// нельзя: в кризисе никто не ищет, что развернуть.
export default async function EmergencyBar() {
  const t = await getTranslations('emergency');

  return (
    <nav
      aria-label={t('navLabel')}
      className="bg-chip px-4 py-2 text-center text-xs text-body"
    >
      <span>{t('disclaimer')} </span>
      {HOTLINES.map(({ number, key }, index) => (
        <span key={number}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          <a
            href={`tel:${number}`}
            className="inline-block rounded px-1 py-1 font-bold text-ink underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {number} — {t(key)}
          </a>
        </span>
      ))}
    </nav>
  );
}
