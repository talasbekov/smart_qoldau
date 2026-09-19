import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import { authorizedFetch } from '@/lib/api/authorized';
import ClientList from '@/components/expert-cabinet/ClientList';
import type { components } from '@/lib/api/generated';

type Client = components['schemas']['ClientCardDto'];

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.expertRecords : ru.expertRecords;
  const items = (await authorizedFetch<Client[]>('experts/me/clients')) ?? [];

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">
        {copy.clientsTitle}
      </h1>
      <ClientList items={items} locale={locale} />
    </>
  );
}
