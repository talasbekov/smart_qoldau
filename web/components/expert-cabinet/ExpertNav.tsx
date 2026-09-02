'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';

// «Клиенты» появились решением Р-27 (расхождение №10 закрыто): психолог
// видит имя и историю встреч тех, кто дал согласие. «Чаты» отдельным
// пунктом по-прежнему нет — переписка живёт внутри консультации.
const SECTIONS = [
  { href: '/expert', label: 'Главная' },
  { href: '/expert/offers', label: 'Заявки' },
  { href: '/expert/consultations', label: 'Консультации' },
  { href: '/expert/clients', label: 'Клиенты' },
  { href: '/expert/schedule', label: 'Расписание' },
  { href: '/expert/earnings', label: 'Доход' },
  { href: '/expert/reviews', label: 'Рейтинг' },
] as const;

const ITEM =
  'block rounded-xl px-4 py-3 text-sm font-semibold text-ink-soft aria-[current=page]:bg-chip aria-[current=page]:text-primary focus:outline-none focus:ring-2 focus:ring-primary';

export default function ExpertNav() {
  const pathname = usePathname();
  const withoutLocale = pathname.replace(/^\/[^/]+/, '') || '/';

  return (
    <nav aria-label="Разделы кабинета" className="flex gap-1 lg:flex-col">
      {SECTIONS.map((section) => {
        const active =
          section.href === '/expert'
            ? withoutLocale === '/expert'
            : withoutLocale === section.href || withoutLocale.startsWith(`${section.href}/`);

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
