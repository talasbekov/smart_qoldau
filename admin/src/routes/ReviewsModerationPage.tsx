import { useEffect, useState } from 'react';
import QueueTable from '@/components/QueueTable';
import { getFlaggedReviews, resolveReview, type FlaggedReview } from '@/lib/reviewsModeration';

export default function ReviewsModerationPage() {
  const [items, setItems] = useState<FlaggedReview[]>([]);

  async function load() {
    setItems(await getFlaggedReviews());
  }

  useEffect(() => {
    load();
  }, []);

  async function handle(id: string, action: 'hide' | 'restore') {
    await resolveReview(id, { action });
    await load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Модерация отзывов</h1>
      <QueueTable
        emptyText="Нет отзывов на модерации"
        rows={items}
        columns={[
          { header: 'Оценка', render: (r) => `${r.rating}/5` },
          { header: 'Текст', render: (r) => r.publicText ?? '—' },
          { header: 'Приватный комментарий', render: (r) => r.privateText ?? '—' },
          { header: 'Жалоба', render: (r) => r.complaint ?? '—' },
          {
            header: '',
            render: (r) => (
              <span className="flex gap-2">
                <button onClick={() => handle(r.id, 'hide')} className="text-sq-danger">
                  Скрыть
                </button>
                <button onClick={() => handle(r.id, 'restore')} className="text-sq-primary">
                  Восстановить
                </button>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
