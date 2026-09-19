import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import TicketConversation from '@/components/support/TicketConversation';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SupportRequestPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);

  return (
    <section className="mx-auto max-w-[1100px] px-4 py-10 sm:px-8 sm:py-14">
      <TicketConversation ticketId={id} locale={locale} userId={user.id} basePath="/expert/support" />
    </section>
  );
}
