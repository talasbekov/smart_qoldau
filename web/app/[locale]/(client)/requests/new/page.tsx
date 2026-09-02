import { listTopics } from '@/lib/api/public';
import RequestForm from '@/components/client/RequestForm';

export default async function NewRequestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const topics = await listTopics();

  return (
    <>
      <h1 className="mb-2 text-2xl font-extrabold text-ink">Расскажите, что вас тревожит</h1>
      <p className="mb-8 text-sm text-muted">
        Подберём специалиста по теме и формату. Обращение анонимно.
      </p>
      <RequestForm topics={topics} locale={locale} />
    </>
  );
}
