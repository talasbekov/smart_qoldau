'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const SECTIONS = [
  { href: '/consultations', label: 'consultations' },
  { href: '/favorites', label: 'favorites' },
  { href: '/notifications', label: 'notifications' },
  { href: '/profile', label: 'profile' },
  { href: '/support/requests', label: 'support' },
] as const;

const ITEM =
  'block rounded-xl px-4 py-3 text-sm font-semibold text-ink-soft aria-[current=page]:bg-chip aria-[current=page]:text-primary focus:outline-none focus:ring-2 focus:ring-primary';

export default function CabinetNav() {
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const copy = locale === 'kz' ? kz.cabinet : ru.cabinet;
  const withoutLocale = pathname.replace(/^\/[^/]+/, '') || '/';

  return (
    <nav
      aria-label={copy.navLabel}
      className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap"
    >
      {SECTIONS.map((section) => {
        // Раздел активен и на своих вложенных страницах: карточка
        // консультации — часть раздела консультаций, и подсветка там
        // пропадать не должна.
        const active =
          withoutLocale === section.href ||
          withoutLocale.startsWith(`${section.href}/`);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={ITEM}
          >
            {copy[section.label]}
          </Link>
        );
      })}
    </nav>
  );
}
