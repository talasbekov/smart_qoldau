import { notFound } from 'next/navigation';
import BookingFlow from '@/components/client/BookingFlow';
import { getExpert, listTopics } from '@/lib/api/public';

export default async function BookExpertPage({
  params,
}: {
  params: Promise<{ locale: string; expertId: string }>;
}) {
  const { locale, expertId } = await params;
  const [expert, topics] = await Promise.all([
    getExpert(expertId),
    listTopics(),
  ]);
  if (!expert) notFound();

  return <BookingFlow expert={expert} topics={topics} locale={locale} />;
}
