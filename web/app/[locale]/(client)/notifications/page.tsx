import { authorizedFetch } from '@/lib/api/authorized';
import NotificationList from '@/components/client/NotificationList';
import type { components } from '@/lib/api/generated';

type List = components['schemas']['NotificationsListDto'];

export default async function NotificationsPage() {
  const list = await authorizedFetch<List>('notifications');

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Уведомления</h1>
      <NotificationList items={list?.items ?? []} unreadCount={list?.unreadCount ?? 0} />
    </>
  );
}
