'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api/client';
import type { Topic } from '@/lib/api/public';

const FORMATS = [
  { value: 'chat', label: 'Чат' },
  { value: 'audio', label: 'Аудио' },
  { value: 'video', label: 'Видео' },
] as const;

const ERRORS: Record<string, string> = {
  REQUEST_RATE_LIMITED: 'Слишком часто. Подождите немного и повторите',
  REQUEST_ALREADY_ACTIVE: 'У вас уже есть активная заявка',
  TOPIC_NOT_FOUND: 'Такой темы больше нет — выберите другую',
};

export default function RequestForm({ topics, locale }: { topics: Topic[]; locale: string }) {
  const router = useRouter();
  const [topicSlug, setTopicSlug] = useState('');
  const [format, setFormat] = useState<'chat' | 'audio' | 'video'>('chat');
  const [isEmergency, setEmergency] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!topicSlug) {
      setError('Выберите тему — по ней мы подбираем специалиста');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const created = await apiFetch<{ id: string }>('requests', {
        method: 'POST',
        body: JSON.stringify({ topicSlug, format, isEmergency }),
      });
      router.push(`/${locale}/requests/${created!.id}`);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : null;
      setError((code && ERRORS[code]) || 'Не удалось создать заявку. Попробуйте ещё раз');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-6">
      <div>
        <label htmlFor="topic" className="mb-1 block text-xs font-semibold text-muted">
          С чем нужна помощь
        </label>
        <select
          id="topic"
          value={topicSlug}
          onChange={(e) => setTopicSlug(e.target.value)}
          className="h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Выберите тему</option>
          {topics.map((topic) => (
            <option key={topic.slug} value={topic.slug}>
              {topic.name}
            </option>
          ))}
        </select>
      </div>

      {/* Радиогруппа, а не список кнопок: выбор один из трёх, и с
          клавиатуры он должен переключаться стрелками. */}
      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-muted">Формат консультации</legend>
        <div className="flex gap-2">
          {FORMATS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-ink has-[:checked]:border-primary has-[:checked]:bg-chip"
            >
              <input
                type="radio"
                name="format"
                value={option.value}
                checked={format === option.value}
                onChange={() => setFormat(option.value)}
                className="accent-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-2xl bg-chip p-4">
        <input
          type="checkbox"
          checked={isEmergency}
          onChange={(e) => setEmergency(e.target.checked)}
          className="mt-1 accent-primary"
        />
        <span className="text-sm text-body">
          <span className="font-bold text-ink">Нужна помощь срочно</span>
          <br />
          Заявку получат только специалисты, готовые подключиться сейчас, и у них будет
          20 секунд на ответ
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="h-12 rounded-2xl bg-primary text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {busy ? 'Ищем специалиста…' : 'Найти специалиста'}
      </button>
    </form>
  );
}
