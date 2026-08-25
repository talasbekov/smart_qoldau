import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('becomeExpert');
  return { title: `${t('heroTitle')} — SmartQoldau`, description: t('heroSubtitle') };
}

export default async function BecomeExpertPage() {
  const t = await getTranslations('becomeExpert');

  return (
    <main>
      <section className="max-w-[1240px] mx-auto px-8 py-16">
        <div className="max-w-[640px]">
          <h1 className="text-[38px] font-extrabold text-ink leading-tight mb-4">{t('heroTitle')}</h1>
          <p className="text-body text-lg mb-6">{t('heroSubtitle')}</p>
          <Link
            href="/support"
            className="inline-flex h-13 px-6 rounded-full bg-primary text-white font-bold items-center"
          >
            {t('heroCta')}
          </Link>
        </div>
      </section>

      <section className="bg-surface py-20 px-8">
        <div className="max-w-[1240px] mx-auto">
          <h2 className="text-[28px] font-extrabold text-ink text-center mb-9">{t('benefitsTitle')}</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-white rounded-2xl border border-border p-6">
                <div className="font-extrabold text-ink mb-1.5">{t(`benefit${n}Title` as 'benefit1Title')}</div>
                <div className="text-muted text-sm">{t(`benefit${n}Text` as 'benefit1Text')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-8">
        <div className="max-w-[1240px] mx-auto">
          <h2 className="text-[28px] font-extrabold text-ink text-center mb-11">{t('stepsTitle')}</h2>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n}>
                <div className="text-primary font-extrabold text-xs mb-2">0{n}</div>
                <div className="font-extrabold text-ink mb-1">{t(`step${n}Title` as 'step1Title')}</div>
                <div className="text-muted text-sm">{t(`step${n}Text` as 'step1Text')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface py-20 px-8">
        <div className="max-w-[720px] mx-auto">
          <h2 className="text-2xl font-extrabold text-ink mb-6">{t('requirementsTitle')}</h2>
          <div className="flex flex-col gap-3 mb-9">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="text-ink-soft text-sm font-semibold">
                ✓ {t(`requirement${n}` as 'requirement1')}
              </div>
            ))}
          </div>
          <Link
            href="/support"
            className="inline-flex h-12 px-6 rounded-full bg-primary text-white font-bold items-center"
          >
            {t('heroCta')}
          </Link>
        </div>
      </section>
    </main>
  );
}
