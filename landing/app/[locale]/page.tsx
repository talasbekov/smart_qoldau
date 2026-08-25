import { getTranslations } from 'next-intl/server';
import { fetchPublicExperts } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';
import SpecialistCard from '@/components/SpecialistCard';
import FaqAccordion from '@/components/FaqAccordion';

export default async function HomePage() {
  const t = await getTranslations('home');
  const experts = await fetchPublicExperts(4);

  const topicKeys = [
    'topicAnxiety',
    'topicDepression',
    'topicPanic',
    'topicAddictions',
    'topicRelationships',
    'topicGrief',
    'topicSelfEsteem',
    'topicBurnout',
    'topicCrisis',
    'topicSleep',
    'topicLoneliness',
    'topicOther',
  ] as const;

  const faqs = Array.from({ length: 9 }, (_, i) => ({
    question: t(`faq${i + 1}Q` as 'faq1Q'),
    answer: t(`faq${i + 1}A` as 'faq1A'),
  }));

  return (
    <main>
      <section className="max-w-[1240px] mx-auto px-8 py-16 flex items-center gap-14 flex-wrap">
        <div className="flex-1 min-w-[340px]">
          <h1 className="text-[44px] font-extrabold text-ink leading-tight mb-4">{t('heroTitle')}</h1>
          <p className="text-body text-lg mb-6 max-w-[480px]">{t('heroSubtitle')}</p>
          <div className="flex gap-3 flex-wrap mb-4">
            <Link
              href="/support"
              className="h-13 px-6 rounded-full bg-primary text-white font-bold flex items-center"
            >
              {t('heroCtaHelp')}
            </Link>
            <Link
              href="/support"
              className="h-13 px-6 rounded-full border border-border font-bold flex items-center text-ink"
            >
              {t('heroCtaCatalog')}
            </Link>
          </div>
          <div className="text-faint text-xs font-semibold">{t('heroAnon')}</div>
        </div>
      </section>

      <section className="bg-surface py-16 px-8">
        <div className="max-w-[1240px] mx-auto">
          <h2 className="text-[28px] font-extrabold text-ink text-center mb-9">{t('formatsTitle')}</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-8">
            {(['Chat', 'Audio', 'Video'] as const).map((format) => (
              <div key={format} className="bg-white rounded-2xl border border-border p-7 text-center">
                <div className="font-extrabold text-ink text-lg mb-2">
                  {t(`format${format}Title` as 'formatChatTitle')}
                </div>
                <div className="text-muted text-sm">{t(`format${format}Text` as 'formatChatText')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-8">
        <div className="max-w-[1240px] mx-auto">
          <h2 className="text-[28px] font-extrabold text-ink text-center mb-2">{t('topicsTitle')}</h2>
          <p className="text-muted text-center mb-9">{t('topicsSubtitle')}</p>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-8">
            {topicKeys.map((key) => (
              <div key={key} className="border border-border rounded-2xl p-4 text-center font-bold text-ink text-sm">
                {t(key)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-8 pb-20">
        <div className="max-w-[1240px] mx-auto bg-chip rounded-3xl p-11 flex items-center justify-between gap-8 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <h2 className="text-2xl font-extrabold text-ink mb-2">{t('urgentTitle')}</h2>
            <p className="text-[#3f6b62] text-sm mb-1 max-w-[520px]">{t('urgentText')}</p>
            <p className="text-[#5f857c] text-xs">{t('urgentEmergency')}</p>
          </div>
          <Link
            href="/support"
            className="h-13 px-7 rounded-full bg-primary text-white font-bold flex items-center whitespace-nowrap"
          >
            {t('urgentCta')}
          </Link>
        </div>
      </section>

      <section className="bg-surface py-20 px-8">
        <div className="max-w-[1240px] mx-auto">
          <h2 className="text-[28px] font-extrabold text-ink text-center mb-2">{t('specialistsTitle')}</h2>
          <p className="text-muted text-center mb-9">{t('specialistsSubtitle')}</p>
          {experts.length === 0 ? (
            <p className="text-center text-muted">{t('specialistsEmpty')}</p>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-4 mb-8">
              {experts.map((expert) => (
                <SpecialistCard key={expert.id} expert={expert} />
              ))}
            </div>
          )}
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
        <div className="max-w-[900px] mx-auto text-center">
          <h2 className="text-2xl font-extrabold text-ink mb-3">{t('anonTitle')}</h2>
          <p className="text-body mb-5">{t('anonText')}</p>
          <Link
            href="/support"
            className="inline-flex h-11 px-5 rounded-full border border-primary text-primary font-bold items-center"
          >
            {t('anonCta')}
          </Link>
        </div>
      </section>

      <section className="py-20 px-8 text-center">
        <h2 className="text-2xl font-extrabold text-ink mb-3">{t('appTitle')}</h2>
        <p className="text-body">{t('appText')}</p>
      </section>

      <section className="bg-surface py-20 px-8">
        <div className="max-w-[1240px] mx-auto">
          <h2 className="text-2xl font-extrabold text-ink text-center mb-9">{t('materialsTitle')}</h2>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-8">
            {(['Breathing', 'Music', 'Articles', 'Meditations'] as const).map((m) => (
              <div key={m} className="bg-white rounded-2xl border border-border p-6 text-center font-bold text-ink text-sm">
                {t(`material${m}` as 'materialBreathing')}
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/support" className="text-primary font-bold text-sm">
              {t('materialsAll')}
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 pb-20">
        <div className="max-w-[1240px] mx-auto bg-gradient-to-br from-ink to-primary-dark rounded-3xl p-11">
          <div className="text-[#7fd6c2] font-extrabold text-xs tracking-wide mb-2">{t('premiumBadge')}</div>
          <h2 className="text-2xl font-extrabold text-white mb-4">{t('premiumTitle')}</h2>
          <div className="flex flex-col gap-1.5 mb-5">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="text-white/80 text-sm">
                ✓ {t(`premiumPerk${n}` as 'premiumPerk1')}
              </div>
            ))}
          </div>
          <Link href="/premium" className="inline-flex h-11 px-5 rounded-full bg-white text-ink font-bold items-center">
            {t('premiumCta')}
          </Link>
        </div>
      </section>

      <section className="bg-surface py-20 px-8">
        <div className="max-w-[1240px] mx-auto flex items-center gap-12 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <h2 className="text-2xl font-extrabold text-ink mb-2">{t('expertTeaserTitle')}</h2>
            <p className="text-body mb-5">{t('expertTeaserText')}</p>
            <div className="grid grid-cols-2 gap-1.5 mb-6">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <div key={n} className="text-ink-soft text-sm font-semibold">
                  ✓ {t(`expertPerk${n}` as 'expertPerk1')}
                </div>
              ))}
            </div>
            <Link
              href="/become-expert"
              className="inline-flex h-12 px-6 rounded-full bg-primary text-white font-bold items-center"
            >
              {t('expertCta')}
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-8">
        <div className="max-w-[1240px] mx-auto">
          <h2 className="text-[28px] font-extrabold text-ink text-center mb-9">{t('trustTitle')}</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n}>
                <div className="font-extrabold text-ink mb-1.5">{t(`trust${n}Title` as 'trust1Title')}</div>
                <div className="text-muted text-sm">{t(`trust${n}Text` as 'trust1Text')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface py-20 px-8">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-[28px] font-extrabold text-ink text-center mb-8">{t('faqTitle')}</h2>
          <FaqAccordion faqs={faqs} />
        </div>
      </section>

      <section className="py-24 px-8 text-center">
        <div className="max-w-[640px] mx-auto">
          <h2 className="text-3xl font-extrabold text-ink mb-3">{t('finalTitle')}</h2>
          <p className="text-body mb-7">{t('finalText')}</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/support" className="h-13 px-7 rounded-full bg-primary text-white font-bold flex items-center">
              {t('finalCtaHelp')}
            </Link>
            <Link
              href="/support"
              className="h-13 px-7 rounded-full border border-border text-ink font-bold flex items-center"
            >
              {t('finalCtaCatalog')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
