import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import CabinetNav from '@/components/client/CabinetNav';
import EmergencyBar from '@/components/emergency/EmergencyBar';

export const metadata: Metadata = {
  // Кабинет в выдаче не нужен, а при утечке ссылки — вреден.
  robots: { index: false, follow: false },
};

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Не проверка прав — их проверяет NestJS на каждом запросе, — а
  // вежливость: не показывать каркас тому, кто не получит ни строки данных.
  await requireUser(locale);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Перейти к основному содержимому
      </a>
      {/* Экстренные службы — и в кабинете: кризис не выбирает страницу. */}
      <EmergencyBar />
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
        <aside className="lg:w-56 lg:shrink-0">
          <CabinetNav />
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </>
  );
}
