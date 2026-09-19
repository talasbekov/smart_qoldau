import { authorizedFetch } from '@/lib/api/authorized';
import { readAccessToken, readRefreshToken } from '@/lib/auth/cookies';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import NavLink from './NavLink';
import LanguageSwitcher from './LanguageSwitcher';

export default async function Header() {
  const t = await getTranslations('nav');
  const locale = await getLocale();
  const signedIn = Boolean(await readAccessToken()) || Boolean(await readRefreshToken());
  const expert = signedIn ? await authorizedFetch('experts/me') : null;
  const cabinet = expert ? '/expert' : '/profile';
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-border">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-extrabold text-ink text-base">SmartQoldau</span>
        </Link>
        <nav className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 sm:order-none sm:w-auto sm:flex-nowrap">
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
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher />
          <Link href={signedIn ? cabinet : "/login"} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary">
            {signedIn ? (locale === 'kz' ? 'Жеке кабинет' : (expert ? 'Кабинет специалиста' : 'Кабинет')) : t('login')}
          </Link>
          <Link
            href="/support"
            className="min-h-11 px-5 rounded-full bg-primary text-white text-xs font-bold flex items-center"
          >
            {t('support')}
          </Link>
        </div>
      </div>
    </header>
  );
}
