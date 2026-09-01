import { useCallback, useEffect, useState } from 'react';
import { listContent, patchContent, deleteContent, type ContentItem } from '@/lib/content';

const KIND_LABELS: Record<ContentItem['kind'], string> = {
  MEDITATION: 'Медитация',
  MUSIC: 'Музыка',
  ARTICLE: 'Статья',
  BREATHING: 'Дыхание',
};

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await listContent());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить материалы');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function togglePublished(item: ContentItem) {
    await patchContent(item.id, { published: item.publishedAt === null });
    await reload();
  }

  async function confirmDelete(id: string) {
    await deleteContent(id);
    setPendingDelete(null);
    await reload();
  }

  if (error) {
    return (
      <div data-testid="content-error" className="p-4 text-sq-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Материалы</h1>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b text-sm text-sq-text-secondary">
            <th className="py-2">Заголовок</th>
            <th>Вид</th>
            <th>Доступ</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2">
                <div className="font-medium">{item.titleRu}</div>
                <div className="text-sm text-sq-text-secondary">{item.slug}</div>
              </td>
              <td>{KIND_LABELS[item.kind]}</td>
              <td data-testid={`access-${item.id}`}>
                {item.access === 'PREMIUM' ? 'Premium' : 'Бесплатно'}
              </td>
              <td data-testid={`status-${item.id}`}>
                {item.publishedAt === null ? 'Черновик' : 'Опубликован'}
              </td>
              <td className="text-right">
                <button
                  data-testid={`publish-${item.id}`}
                  className="px-3 py-1 rounded bg-sq-chip text-sq-primary-dark mr-2"
                  onClick={() => void togglePublished(item)}
                >
                  {item.publishedAt === null ? 'Опубликовать' : 'Снять'}
                </button>
                <button
                  data-testid={`delete-${item.id}`}
                  className="px-3 py-1 rounded bg-red-100 text-red-800"
                  onClick={() => setPendingDelete(item.id)}
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pendingDelete !== null && (
        <div className="mt-4 p-4 border rounded bg-red-50">
          {/* Удаление уносит прогресс и голоса людей — спрашиваем прежде,
              чем это станет необратимым. */}
          <p className="mb-2">Удалить материал вместе с прогрессом и голосами?</p>
          <button
            data-testid="confirm-delete"
            className="px-3 py-1 rounded bg-sq-danger text-white mr-2"
            onClick={() => void confirmDelete(pendingDelete)}
          >
            Удалить
          </button>
          <button className="px-3 py-1 rounded border" onClick={() => setPendingDelete(null)}>
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
