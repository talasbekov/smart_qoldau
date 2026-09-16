import { authorizedFetch } from '@/lib/api/authorized';
import ConsultationList, {
  type Consultation,
} from '@/components/client/ConsultationList';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const items = (await authorizedFetch<Consultation[]>('consultations')) ?? [];
  const copy = locale === 'kz' ? kz.cabinet : ru.cabinet;

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">
        {copy.consultations}
      </h1>
      <ConsultationList items={items} locale={locale} />
    </>
  );
}
