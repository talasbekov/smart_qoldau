'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import type { Topic } from '@/lib/api/public';
import OfferList from '@/components/expert-cabinet/OfferList';
import { deskCopy } from './copy';

/** Mount once in the expert layout. Main/offers pages own their full list. */
export default function IncomingOffers({ locale }: { locale: string }) {
  const pathname = usePathname();
  const [topics, setTopics] = useState<Topic[]>([]);
  useEffect(() => {
    let alive = true;
    void apiFetch<Topic[]>(`topics?locale=${locale === 'kz' ? 'kz' : 'ru'}`)
      .then((result) => {
        if (alive && result) setTopics(result);
      })
      .catch(() => {
        /* Offer topic slugs remain visible if names are unavailable. */
      });
    return () => {
      alive = false;
    };
  }, [locale]);
  if (
    pathname === `/${locale}/expert` ||
    pathname === `/${locale}/expert/offers`
  )
    return null;
  return (
    <section aria-label={deskCopy(locale).incoming}>
      <OfferList initial={[]} topics={topics} locale={locale} hideEmpty />
    </section>
  );
}
