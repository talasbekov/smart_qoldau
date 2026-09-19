import { authorizedFetch } from '@/lib/api/authorized';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import NotificationList from '@/components/client/NotificationList';
import type { components } from '@/lib/api/generated';

type List = components['schemas']['NotificationsListDto'];

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.notifications : ru.notifications;
  const list = await authorizedFetch<List>('notifications');

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">{copy.title}</h1>
      <NotificationList
        locale={locale}
        items={list?.items ?? []}
        unreadCount={list?.unreadCount ?? 0}
      />
    </>
  );
}
