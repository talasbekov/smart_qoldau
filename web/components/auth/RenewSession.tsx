'use client';

import { useEffect, useRef, useState } from 'react';
import { renewSession } from '@/lib/auth/browser-session';

export default function RenewSession({ locale, returnTo }: { locale: string; returnTo: string }) {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void renewSession().then(() => {
      // A full navigation guarantees the next SSR request includes renewed
      // cookies; no protected RSC request races the credential write.
      window.location.replace(returnTo);
    }).catch(() => setFailed(true));
  }, [returnTo]);
  const kz = locale === 'kz';
  return <main className="mx-auto max-w-md px-8 py-20">
    <p role={failed ? 'alert' : 'status'}>{failed
      ? (kz ? 'Сессияны жаңарту мүмкін болмады. Қайта кіріңіз.' : 'Не удалось обновить сессию. Войдите снова.')
      : (kz ? 'Сессия жаңартылуда…' : 'Обновляем сессию…')}</p>
    {failed && <a className="mt-4 inline-block underline" href={`/${locale}/login`}>{kz ? 'Кіру' : 'Войти'}</a>}
  </main>;
}
