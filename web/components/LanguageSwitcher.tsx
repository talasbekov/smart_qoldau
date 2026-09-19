'use client';

import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function CurrentLanguageLink() {
  const pathname = usePathname();
  const search = useSearchParams();
  const current = pathname.startsWith('/kz') ? 'kz' : 'ru';
  const target = current === 'kz' ? 'ru' : 'kz';
  const path = pathname.replace(/^\/(ru|kz)(?=\/|$)/, '');
  const params = new URLSearchParams(search.toString());
  if (params.get('returnTo') === `/${current}/requests/new`) {
    params.set('returnTo', `/${target}/requests/new`);
  }
  const query = params.toString();

  return (
    <a
      href={`/${target}${path}${query ? `?${query}` : ''}`}
      hrefLang={target === 'kz' ? 'kk' : 'ru'}
      lang={target === 'kz' ? 'kk' : 'ru'}
      className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {target === 'kz' ? 'Қазақша' : 'Русский'}
    </a>
  );
}

export default function LanguageSwitcher() {
  return (
    <Suspense fallback={null}>
      <CurrentLanguageLink />
    </Suspense>
  );
}
