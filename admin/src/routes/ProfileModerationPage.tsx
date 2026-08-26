import { useEffect, useState } from 'react';
import QueueTable from '@/components/QueueTable';
import { getModerationQueue, decidePhoto, decideAbout, type ModerationItem } from '@/lib/profileModeration';

export default function ProfileModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([]);

  async function load() {
    const result = await getModerationQueue({ take: 50, skip: 0 });
    setItems(result.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function approvePhoto(expertId: string) {
    await decidePhoto(expertId, { action: 'approve' });
    await load();
  }

  async function rejectPhoto(expertId: string) {
    const comment = window.prompt('Причина отклонения фото:');
    if (!comment) return;
    await decidePhoto(expertId, { action: 'reject', comment });
    await load();
  }

  async function approveAbout(expertId: string) {
    await decideAbout(expertId, { action: 'approve' });
    await load();
  }

  async function rejectAbout(expertId: string) {
    const comment = window.prompt('Причина отклонения текста:');
    if (!comment) return;
    await decideAbout(expertId, { action: 'reject', comment });
    await load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Модерация профиля</h1>
      <QueueTable
        emptyText="Очередь пуста"
        rows={items.map((item) => ({ ...item, id: item.expertId }))}
        columns={[
          { header: 'Эксперт', render: (r) => r.displayName },
          {
            header: 'Фото',
            render: (r) =>
              r.photoPendingUrl ? (
                <span className="flex gap-2">
                  <button onClick={() => approvePhoto(r.expertId)} className="text-sq-primary">
                    Одобрить фото
                  </button>
                  <button onClick={() => rejectPhoto(r.expertId)} className="text-sq-danger">
                    Отклонить фото
                  </button>
                </span>
              ) : (
                '—'
              ),
          },
          {
            header: 'О себе',
            render: (r) =>
              r.aboutPending ? (
                <span className="flex gap-2">
                  <button onClick={() => approveAbout(r.expertId)} className="text-sq-primary">
                    Одобрить текст
                  </button>
                  <button onClick={() => rejectAbout(r.expertId)} className="text-sq-danger">
                    Отклонить текст
                  </button>
                </span>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </div>
  );
}
