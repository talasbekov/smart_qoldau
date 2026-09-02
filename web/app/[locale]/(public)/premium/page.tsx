import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { getPremiumPlans } from '@/lib/api/public';

function tenge(tiyn: number): string {
  return `${new Intl.NumberFormat('ru-KZ').format(Math.round(tiyn / 100))} ₸`;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('premium');
  return { title: `${t('title')} — SmartQoldau`, description: t('subtitle') };
}

export default async function PremiumPage() {
  const t = await getTranslations('premium');
  const plans = await getPremiumPlans();
  const priceOf = (plan: 'MONTH' | 'YEAR', fallbackKey: 'priceMonthly' | 'priceYearly') => {
    const found = plans?.plans.find((p) => p.plan === plan);
    // Запасной вариант из перевода — только на случай, если бэкенд
    // недоступен: страница тарифов не должна падать целиком из-за него.
    return found ? tenge(found.priceTiyn) : t(fallbackKey);
  };

  return (
    <main className="max-w-[900px] mx-auto px-8 py-16 text-center">
      <div className="text-primary font-extrabold text-xs tracking-wide mb-3">{t('badge')}</div>
      <h1 className="text-[32px] font-extrabold text-ink mb-3">{t('title')}</h1>
      <p className="text-body max-w-[560px] mx-auto mb-12">{t('subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left mb-8">
        <div className="rounded-3xl border border-border p-7">
          <div className="font-extrabold text-ink mb-1">{t('basicName')}</div>
          <div className="text-2xl font-extrabold text-ink mb-4">{t('basicPrice')}</div>
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="text-ink-soft text-sm font-semibold">
                ✓ {t(`basicPerk${n}` as 'basicPerk1')}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-ink to-primary-dark p-7">
          <div className="font-extrabold text-white mb-1">{t('premiumName')}</div>
          <div className="text-2xl font-extrabold text-white mb-1">
            {priceOf('MONTH', 'priceMonthly')}
            <span className="text-xs font-semibold text-white/60"> {t('pricePeriodMonthly')}</span>
          </div>
          <div className="text-sm font-semibold text-white/70 mb-4">
            {priceOf('YEAR', 'priceYearly')}
            <span className="text-xs font-semibold text-white/50"> {t('pricePeriodYearly')}</span>
          </div>
          <div className="flex flex-col gap-2 mb-5">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="text-white/85 text-sm font-semibold">
                ✓ {t(`premiumPerk${n}` as 'premiumPerk1')}
              </div>
            ))}
          </div>
          <Link href="/support" className="flex items-center justify-center h-11 rounded-full bg-white text-ink font-bold">
            {t('cta')}
          </Link>
        </div>
      </div>

      <p className="text-faint text-xs">{t('disclaimer')}</p>
    </main>
  );
}
