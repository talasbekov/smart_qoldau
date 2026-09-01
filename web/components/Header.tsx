import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';

export default async function Header() {
  const t = await getTranslations('nav');
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-border">
      <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-4 px-8 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-extrabold text-ink text-base">SmartQoldau</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/" className="text-xs font-semibold text-ink-soft">
            {t('home')}
          </Link>
          <Link href="/become-expert" className="text-xs font-semibold text-ink-soft">
            {t('becomeExpert')}
          </Link>
          <Link href="/about" className="text-xs font-semibold text-ink-soft">
            {t('about')}
          </Link>
          <Link href="/premium" className="text-xs font-semibold text-ink-soft">
            {t('premium')}
          </Link>
        </nav>
        <Link
          href="/support"
          className="h-10 px-5 rounded-full bg-primary text-white text-xs font-bold flex items-center"
        >
          {t('support')}
        </Link>
      </div>
    </header>
  );
}
