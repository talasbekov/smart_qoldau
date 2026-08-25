import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';

export default async function Footer() {
  const t = await getTranslations('footer');
  return (
    <footer className="bg-ink px-8 pt-14 pb-8">
      <div className="max-w-[1240px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div>
            <div className="text-white font-extrabold text-sm mb-2">SmartQoldau</div>
            <div className="text-white/50 text-xs">{t('tagline')}</div>
          </div>
          <div>
            <div className="text-white/90 font-bold text-xs mb-3">{t('clientsTitle')}</div>
            <div className="flex flex-col gap-2">
              <Link href="/support" className="text-white/55 text-xs">
                {t('clientsSupport')}
              </Link>
              <Link href="/premium" className="text-white/55 text-xs">
                {t('clientsPremium')}
              </Link>
            </div>
          </div>
          <div>
            <div className="text-white/90 font-bold text-xs mb-3">{t('expertsTitle')}</div>
            <Link href="/become-expert" className="text-white/55 text-xs">
              {t('expertsBecome')}
            </Link>
          </div>
          <div>
            <div className="text-white/90 font-bold text-xs mb-3">{t('docsTitle')}</div>
            <div className="flex flex-col gap-2">
              <Link href="/privacy" className="text-white/55 text-xs">
                {t('docsPrivacy')}
              </Link>
              <Link href="/terms" className="text-white/55 text-xs">
                {t('docsTerms')}
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-5 text-white/40 text-xs text-center">
          {t('copyright')}
        </div>
      </div>
    </footer>
  );
}
