import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import SupportCenter from '@/components/support/SupportCenter';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SupportRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const copy = locale === 'kz' ? kz.supportPortal : ru.supportPortal;

  return (
    <section className="mx-auto max-w-[1100px] px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-extrabold text-ink">{copy.pageTitle}</h1>
      <p className="mb-8 mt-2 max-w-2xl text-body">{copy.pageSubtitle}</p>
      <SupportCenter locale={locale} userId={user.id} basePath="/expert/support" />
    </section>
  );
}
