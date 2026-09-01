'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/generated';

type Notification = components['schemas']['NotificationDto'];

export default function NotificationList({
  items,
  unreadCount,
}: {
  items: Notification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markAllRead() {
    setBusy(true);
    await apiFetch('notifications/read', {
      method: 'POST',
      body: JSON.stringify({ ids: items.filter((i) => !i.readAt).map((i) => i.id) }),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  if (items.length === 0) {
    return <p className="py-12 text-body">У вас пока нет уведомлений</p>;
  }

  return (
    <>
      {unreadCount > 0 && (
        <button
          type="button"
          onClick={markAllRead}
          disabled={busy}
          className="mb-4 rounded-2xl border border-border px-4 py-2 text-sm font-bold text-primary disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Прочитано
        </button>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((notification) => (
          <li key={notification.id} className="rounded-[20px] border border-border bg-white p-5">
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm font-extrabold text-ink">{notification.title}</p>
              {/* Словом, а не только цветом: цвет не читается скринридером
                  и не различается частью людей. */}
              {!notification.readAt && (
                <span className="rounded-full bg-chip px-2 py-0.5 text-xs font-bold text-ink">
                  Новое
                </span>
              )}
            </div>
            <p className="text-sm text-body">{notification.body}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
