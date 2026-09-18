import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { listContent, patchContent, deleteContent, type ContentItem } from '@/lib/content';

const KIND_LABELS: Record<ContentItem['kind'], string> = {
  MEDITATION: 'Медитация',
  MUSIC: 'Музыка',
  ARTICLE: 'Статья',
  BREATHING: 'Дыхание',
};

export default function ContentPage() {
  const location = useLocation();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(() => {
    const state = location.state as { success?: unknown } | null;
    return typeof state?.success === 'string' ? state.success : null;
  });

  const reload = useCallback(async () => {
    try {
      setItems(await listContent());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить материалы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function togglePublished(item: ContentItem) {
    if (pendingAction) return;
    setPendingAction(item.id);
    setError(null);
    setSuccess(null);
    try {
      const publishing = item.publishedAt === null;
      await patchContent(item.id, { published: publishing });
      await reload();
      setSuccess(publishing ? 'Материал опубликован.' : 'Материал снят с публикации.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось изменить публикацию.');
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmDelete(id: string) {
    if (pendingAction) return;
    setPendingAction(id);
    setError(null);
    setSuccess(null);
    try {
      await deleteContent(id);
      setPendingDelete(null);
      await reload();
      setSuccess('Материал удалён.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось удалить материал.');
    } finally {
      setPendingAction(null);
    }
  }

  if (loading) {
    return <p className="p-4 text-sq-text-secondary">Загрузка материалов…</p>;
  }

  if (error && items.length === 0) {
    return (
      <div data-testid="content-error" className="p-4">
        <p role="alert" className="mb-3 text-sq-danger">{error}</p>
        <button type="button" className="rounded-lg border px-4 py-2 font-semibold" onClick={() => { setLoading(true); void reload(); }}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Материалы</h1>
          <p className="mt-1 text-sm text-sq-text-secondary">Создавайте черновики, проверяйте обе локали и публикуйте готовые материалы.</p>
        </div>
        <Link to="/content/new" className="rounded-lg bg-sq-primary-dark px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">Создать материал</Link>
      </div>
      {success && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-sq-danger">{error}</p>}
      {items.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-semibold">Материалов пока нет</p><p className="mt-1 text-sm text-sq-text-secondary">Создайте первый черновик — клиенты не увидят его до публикации.</p></div> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[760px] text-left border-collapse">
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
                <Link to={`/content/${item.id}/edit`} aria-label={`Редактировать ${item.titleRu}`} className="mr-2 inline-block rounded border px-3 py-1 text-sq-primary-dark hover:bg-sq-surface-muted">
                  Редактировать
                </Link>
                <button
                  data-testid={`publish-${item.id}`}
                  className="px-3 py-1 rounded bg-sq-chip text-sq-primary-dark mr-2"
                  onClick={() => void togglePublished(item)}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === item.id ? 'Сохранение…' : item.publishedAt === null ? 'Опубликовать' : 'Снять'}
                </button>
                <button
                  data-testid={`delete-${item.id}`}
                  className="px-3 py-1 rounded bg-red-100 text-red-800"
                  onClick={() => setPendingDelete(item.id)}
                  disabled={pendingAction !== null}
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>}

      {pendingDelete !== null && (
        <div className="mt-4 p-4 border rounded bg-red-50">
          {/* Удаление уносит прогресс и голоса людей — спрашиваем прежде,
              чем это станет необратимым. */}
          <p className="mb-2">Удалить материал вместе с прогрессом и голосами?</p>
          <button
            data-testid="confirm-delete"
            className="px-3 py-1 rounded bg-sq-danger text-white mr-2"
            onClick={() => void confirmDelete(pendingDelete)}
            disabled={pendingAction !== null}
          >
            {pendingAction === pendingDelete ? 'Удаление…' : 'Удалить'}
          </button>
          <button className="px-3 py-1 rounded border" onClick={() => setPendingDelete(null)}>
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
