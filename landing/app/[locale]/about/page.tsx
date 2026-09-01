import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about');
  return { title: `${t('title')} — SmartQoldau`, description: t('lead') };
}

/// Страница «О нас» по прототипу `SmartQoldau Web - О нас`: обещание
/// платформы, три факта о ней, принципы и выход на поддержку.
export default async function AboutPage() {
  const t = await getTranslations('about');

  const facts = [
    { value: t('fact1Value'), label: t('fact1Label') },
    { value: t('fact2Value'), label: t('fact2Label') },
    { value: t('fact3Value'), label: t('fact3Label') },
  ];

  const principles = [1, 2, 3, 4] as const;

  return (
    <main className="max-w-[900px] mx-auto px-8 py-16">
      <h1 className="text-[32px] font-extrabold text-ink mb-3">{t('title')}</h1>
      <p className="text-body max-w-[620px] mb-12">{t('lead')}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-3xl border border-border p-7">
            <div className="text-2xl font-extrabold text-ink mb-1">{fact.value}</div>
            <div className="text-sm text-body">{fact.label}</div>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-extrabold text-ink mb-5">{t('principlesTitle')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-14">
        {principles.map((n) => (
          <div key={n} className="rounded-3xl border border-border p-7">
            <div className="font-extrabold text-ink mb-1">
              {t(`principle${n}Title` as 'principle1Title')}
            </div>
            <div className="text-sm text-body">
              {t(`principle${n}Text` as 'principle1Text')}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-surface p-8 text-center">
        <div className="font-extrabold text-ink mb-1">{t('contactTitle')}</div>
        <p className="text-body text-sm mb-5">{t('contactText')}</p>
        <Link
          href="/support"
          className="inline-block rounded-full bg-primary px-6 py-3 font-bold text-white"
        >
          {t('contactCta')}
        </Link>
      </div>
    </main>
  );
}
