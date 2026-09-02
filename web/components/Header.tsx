import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import NavLink from './NavLink';

export default async function Header() {
  const t = await getTranslations('nav');
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-border">
      <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-4 px-8 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-extrabold text-ink text-base">SmartQoldau</span>
        </Link>
        <nav className="flex items-center gap-4">
          <NavLink href="/" className="rounded px-1 py-2 text-xs font-semibold text-ink-soft aria-[current=page]:text-primary aria-[current=page]:underline aria-[current=page]:underline-offset-4">
            {t('home')}
          </NavLink>
          <NavLink href="/become-expert" className="rounded px-1 py-2 text-xs font-semibold text-ink-soft aria-[current=page]:text-primary aria-[current=page]:underline aria-[current=page]:underline-offset-4">
            {t('becomeExpert')}
          </NavLink>
          <NavLink
            href="/catalog"
            className="rounded px-1 py-2 text-xs font-semibold text-ink-soft aria-[current=page]:text-primary aria-[current=page]:underline aria-[current=page]:underline-offset-4"
          >
            {t('catalog')}
          </NavLink>
          <NavLink
            href="/materials"
            className="rounded px-1 py-2 text-xs font-semibold text-ink-soft aria-[current=page]:text-primary aria-[current=page]:underline aria-[current=page]:underline-offset-4"
          >
            {t('materials')}
          </NavLink>
          <NavLink href="/about" className="rounded px-1 py-2 text-xs font-semibold text-ink-soft aria-[current=page]:text-primary aria-[current=page]:underline aria-[current=page]:underline-offset-4">
            {t('about')}
          </NavLink>
          <NavLink href="/premium" className="rounded px-1 py-2 text-xs font-semibold text-ink-soft aria-[current=page]:text-primary aria-[current=page]:underline aria-[current=page]:underline-offset-4">
            {t('premium')}
          </NavLink>
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
