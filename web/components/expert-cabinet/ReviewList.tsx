'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/generated';

type Review = components['schemas']['OwnReviewItemDto'];
type Distribution = Record<string, number>;

function Bar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <li className="flex items-center gap-3 text-xs text-muted">
      <span className="w-10 shrink-0">{stars} ★</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-chip">
        <span
          className="block h-full bg-primary"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        />
      </span>
      {/* Процент словом рядом с полоской: полоска без числа не читается
          скринридером и не сравнивается точно. */}
      <span className="w-10 shrink-0 text-right">{percent}%</span>
    </li>
  );
}

function ReplyForm({ reviewId, onDone }: { reviewId: string; onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;

    setBusy(true);
    await apiFetch(`reviews/${reviewId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ text: trimmed }),
    }).catch(() => null);
    setBusy(false);
    onDone();
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <label htmlFor={`reply-${reviewId}`} className="text-xs font-semibold text-muted">
        Ваш ответ
      </label>
      <textarea
        id={`reply-${reviewId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        className="rounded-2xl border border-border p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="self-start rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {busy ? 'Отправляем…' : 'Отправить ответ'}
      </button>
    </div>
  );
}

export default function ReviewList({
  items,
  ratingAvg,
  ratingCount,
  distribution,
}: {
  items: Review[];
  ratingAvg: number;
  ratingCount: number;
  distribution: Distribution;
}) {
  const router = useRouter();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  if (ratingCount === 0 && items.length === 0) {
    return <p className="py-12 text-body">Отзывов пока нет</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[20px] border border-border bg-white p-6">
        <p className="mb-4 text-2xl font-extrabold text-ink">
          {ratingAvg.toFixed(1)} ★ · {ratingCount} отзывов
        </p>
        <ul className="flex flex-col gap-2">
          {[5, 4, 3, 2, 1].map((stars) => (
            <Bar
              key={stars}
              stars={stars}
              count={distribution[String(stars)] ?? 0}
              total={ratingCount}
            />
          ))}
        </ul>
      </section>

      <ul className="flex flex-col gap-4">
        {items.map((review) => (
          <li key={review.id} className="rounded-[20px] border border-border bg-white p-5">
            <p className="mb-1 text-sm font-bold text-ink">
              {'★'.repeat(review.rating)}
              <span className="sr-only">{`оценка ${review.rating} из 5`}</span>
            </p>
            {/* Отзыв не называет клиента и после Р-27: карточку клиента
                видит только его психолог, а отзыв читают все. */}
            <p className="mb-2 text-xs text-faint">
              {new Date(review.createdAt).toLocaleDateString('ru-KZ')} · Анонимный клиент
            </p>
            {review.publicText && (
              <p className="text-sm leading-relaxed text-body">{review.publicText}</p>
            )}

            {review.expertReply ? (
              <div className="mt-3 border-l-2 border-chip pl-3">
                <p className="text-xs font-semibold text-muted">Ваш ответ</p>
                <p className="text-sm text-body">{review.expertReply}</p>
              </div>
            ) : replyingTo === review.id ? (
              <ReplyForm
                reviewId={review.id}
                onDone={() => {
                  setReplyingTo(null);
                  router.refresh();
                }}
              />
            ) : (
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setReplyingTo(review.id)}
                  className="rounded-xl px-3 py-2 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  Ответить
                </button>
                <button
                  type="button"
                  onClick={() =>
                    apiFetch(`reviews/${review.id}/complaint`, {
                      method: 'POST',
                      body: JSON.stringify({ text: 'Жалоба из кабинета' }),
                    }).catch(() => null)
                  }
                  className="rounded-xl px-3 py-2 text-sm font-bold text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  Пожаловаться
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
