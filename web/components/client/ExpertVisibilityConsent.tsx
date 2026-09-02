'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';

// Р-27. Один экран, а не два шага: между «объяснили» и «спросили имя»
// человек, решившийся попросить помощи, легко передумает.
export default function ExpertVisibilityConsent() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Напишите, как к вам обращаться');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await apiFetch('me/expert-visibility', {
        method: 'POST',
        body: JSON.stringify({ displayName: trimmed }),
      });
      router.refresh();
    } catch {
      setError('Не удалось сохранить. Попробуйте ещё раз');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-extrabold text-ink">Прежде чем начать</h1>

      <div className="rounded-[20px] bg-chip p-5 text-sm leading-relaxed text-body">
        <p className="mb-3">
          Психолог, который будет с вами работать, увидит{' '}
          <strong className="text-ink">ваше имя</strong> и{' '}
          <strong className="text-ink">историю встреч с ним</strong>: когда вы
          общались, о чём и что он записал по итогам.
        </p>
        {/* Сказать, чего НЕ видно, не менее важно: иначе человек додумает
            худшее — например, что видно телефон. */}
        <p>
          Ваш <strong className="text-ink">телефон психологу не показывается</strong>, и
          другие специалисты вашу историю не видят.
        </p>
      </div>

      <div>
        <label htmlFor="display-name" className="mb-1 block text-xs font-semibold text-muted">
          Как к вам обращаться
        </label>
        <input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          className="h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-muted">
          Можно указать только имя или любое обращение — документы мы не проверяем
        </p>
      </div>

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
        {busy ? 'Сохраняем…' : 'Продолжить'}
      </button>
    </form>
  );
}
