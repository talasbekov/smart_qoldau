'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';

const SECTIONS = [
  { href: '/consultations', label: 'Консультации' },
  { href: '/favorites', label: 'Избранное' },
  { href: '/notifications', label: 'Уведомления' },
  { href: '/profile', label: 'Профиль' },
] as const;

const ITEM =
  'block rounded-xl px-4 py-3 text-sm font-semibold text-ink-soft aria-[current=page]:bg-chip aria-[current=page]:text-primary focus:outline-none focus:ring-2 focus:ring-primary';

export default function CabinetNav() {
  const pathname = usePathname();
  const withoutLocale = pathname.replace(/^\/[^/]+/, '') || '/';

  return (
    <nav aria-label="Разделы кабинета" className="flex gap-1 lg:flex-col">
      {SECTIONS.map((section) => {
        // Раздел активен и на своих вложенных страницах: карточка
        // консультации — часть раздела консультаций, и подсветка там
        // пропадать не должна.
        const active =
          withoutLocale === section.href || withoutLocale.startsWith(`${section.href}/`);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={ITEM}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
