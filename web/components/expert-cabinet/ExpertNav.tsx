'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

// «Клиенты» появились решением Р-27 (расхождение №10 закрыто): психолог
// видит имя и историю встреч тех, кто дал согласие. «Чаты» отдельным
// пунктом по-прежнему нет — переписка живёт внутри консультации.
const ITEM =
  'block rounded-xl px-4 py-3 text-sm font-semibold text-ink-soft aria-[current=page]:bg-chip aria-[current=page]:text-primary focus:outline-none focus:ring-2 focus:ring-primary';

export default function ExpertNav({ locale = 'ru' }: { locale?: string }) {
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const sections = [
    { href: '/expert', label: copy.navMain },
    { href: '/expert/offers', label: copy.navOffers },
    { href: '/expert/consultations', label: copy.navConsultations },
    { href: '/expert/clients', label: copy.navClients },
    { href: '/expert/schedule', label: copy.navSchedule },
    { href: '/expert/earnings', label: copy.navEarnings },
    { href: '/expert/reviews', label: copy.navRating },
    { href: '/support/requests', label: copy.navSupport },
  ] as const;
  const pathname = usePathname();
  const withoutLocale = pathname.replace(/^\/[^/]+/, '') || '/';

  return (
    <nav
      aria-label={copy.navLabel}
      className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
    >
      {sections.map((section) => {
        const active =
          section.href === '/expert'
            ? withoutLocale === '/expert'
            : withoutLocale === section.href ||
              withoutLocale.startsWith(`${section.href}/`);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={`${ITEM} min-h-11 shrink-0`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
