import { listTopics } from '@/lib/api/public';
import { authorizedFetch } from '@/lib/api/authorized';
import RequestForm from '@/components/client/RequestForm';
import ExpertVisibilityConsent from '@/components/client/ExpertVisibilityConsent';

type Profile = { displayName: string | null; expertVisibilityAcceptedAt: string | null };

export default async function NewRequestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [topics, profile] = await Promise.all([
    listTopics(),
    authorizedFetch<Profile>('me'),
  ]);

  // Р-27: согласие спрашивается один раз, перед первой заявкой. Проверка
  // здесь — вежливость: сервер всё равно откажет без него, но человеку
  // лучше увидеть объяснение, а не ошибку после заполнения формы.
  if (!profile?.expertVisibilityAcceptedAt) {
    return <ExpertVisibilityConsent />;
  }

  return (
    <>
      <h1 className="mb-2 text-2xl font-extrabold text-ink">Расскажите, что вас тревожит</h1>
      <p className="mb-8 text-sm text-muted">
        Подберём специалиста по теме и формату. Обращение конфиденциально.
      </p>
      <RequestForm topics={topics} locale={locale} />
    </>
  );
}
