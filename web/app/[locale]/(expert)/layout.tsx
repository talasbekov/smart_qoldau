import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { authorizedFetch } from '@/lib/api/authorized';
import ExpertNav from '@/components/expert-cabinet/ExpertNav';
import WorkStatusToggle from '@/components/expert-cabinet/WorkStatusToggle';
import EmergencyBar from '@/components/emergency/EmergencyBar';

type ExpertMe = { displayName: string; workStatus: 'ACCEPTING' | 'BUSY' | 'NOT_ACCEPTING' | 'UNAVAILABLE' };

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
  await requireUser(locale);
  const me = await authorizedFetch<ExpertMe>('experts/me');

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Перейти к основному содержимому
      </a>
      {/* Эксперт тоже человек и тоже может столкнуться с кризисом —
          своим или клиента. Полоса остаётся. */}
      <EmergencyBar />
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
        <aside className="flex flex-col gap-4 lg:w-60 lg:shrink-0">
          <WorkStatusToggle initial={me?.workStatus ?? 'NOT_ACCEPTING'} />
          <ExpertNav />
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </>
  );
}
