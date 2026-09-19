import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { authorizedFetch } from '@/lib/api/authorized';
import IncomingOffers from '@/components/expert-desk/IncomingOffers';
import ExpertNav from '@/components/expert-cabinet/ExpertNav';
import WorkStatusToggle from '@/components/expert-cabinet/WorkStatusToggle';
import EmergencyBar from '@/components/emergency/EmergencyBar';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type ExpertMe = {
  displayName: string;
  workStatus: 'ACCEPTING' | 'BUSY' | 'NOT_ACCEPTING' | 'UNAVAILABLE';
};

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ExpertLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const sessionUser = await requireUser(locale);
  const me = await authorizedFetch<ExpertMe>('experts/me');
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;

  if (!me) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p
          role="alert"
          className="rounded-2xl border border-border bg-white p-6 text-body"
        >
          {copy.expertAccessError}
          <Link className="mt-4 block font-bold text-primary underline" href={`/${locale}/expert-onboarding`}>
            {locale === 'kz' ? 'Маманның сауалнамасын толтыру' : 'Заполнить анкету специалиста'}
          </Link>
        </p>
      </main>
    );
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {copy.skipToMain}
      </a>
      {/* Эксперт тоже человек и тоже может столкнуться с кризисом —
          своим или клиента. Полоса остаётся. */}
      <EmergencyBar />
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
        <aside className="flex flex-col gap-4 lg:w-60 lg:shrink-0">
          <WorkStatusToggle initial={me.workStatus} locale={locale} />
          <ExpertNav locale={locale} />
        </aside>
        <main data-session-owner={sessionUser.id} id="main" className="min-w-0 flex-1">
          <IncomingOffers locale={locale} />
          {children}
        </main>
      </div>
    </>
  );
}
