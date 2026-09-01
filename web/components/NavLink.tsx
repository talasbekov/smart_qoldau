'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';

// Ссылка навигации, знающая, что она текущая. Клиентская: путь известен
// только в браузере. Само выделение — не украшение: без него человек не
// понимает, где находится, а скринридер не объявляет текущую страницу.
export default function NavLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  // Путь всегда начинается со слага локали: /ru, /ru/about.
  const withoutLocale = pathname.replace(/^\/[^/]+/, '') || '/';

  // Точное совпадение, а не «начинается с»: иначе главная (href="/")
  // считалась бы активной на каждой странице сайта.
  const active = withoutLocale === href;

  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={className}>
      {children}
    </Link>
  );
}
