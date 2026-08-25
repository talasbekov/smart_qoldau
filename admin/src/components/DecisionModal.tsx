import { useState } from 'react';

export default function DecisionModal({
  title,
  requireCommentOnReject,
  onSubmit,
  onClose,
}: {
  title: string;
  requireCommentOnReject: boolean;
  onSubmit: (decision: { approve: boolean; comment?: string }) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handle(approve: boolean) {
    if (!approve && requireCommentOnReject && !comment.trim()) {
      setError('Комментарий обязателен при отклонении');
      return;
    }
    onSubmit({ approve, comment: comment.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-3">
        <h2 className="font-bold">{title}</h2>
        <textarea
          placeholder="Комментарий"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="border rounded px-3 py-2"
          rows={3}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded border">
            Отмена
          </button>
          <button onClick={() => handle(false)} className="px-4 py-2 rounded bg-red-600 text-white">
            Отклонить
          </button>
          <button onClick={() => handle(true)} className="px-4 py-2 rounded bg-teal-700 text-white">
            Одобрить
          </button>
        </div>
      </div>
    </div>
  );
}
