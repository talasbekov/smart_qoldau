'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';

// Р-27. Один экран, а не два шага: между «объяснили» и «спросили имя»
// человек, решившийся попросить помощи, легко передумает.
export default function ExpertVisibilityConsent({
  locale = 'ru',
}: {
  locale?: string;
}) {
  const kk = locale === 'kz';
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(
        kk
          ? 'Сізге қалай жүгінуге болатынын жазыңыз'
          : 'Напишите, как к вам обращаться',
      );
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
      setError(
        kk
          ? 'Сақтау мүмкін болмады. Қайталап көріңіз'
          : 'Не удалось сохранить. Попробуйте ещё раз',
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-extrabold text-ink">
        {kk ? 'Бастамас бұрын' : 'Прежде чем начать'}
      </h1>

      <div className="rounded-[20px] bg-chip p-5 text-sm leading-relaxed text-body">
        <p className="mb-3">
          {kk
            ? 'Сізбен жұмыс істейтін психолог атыңызды және онымен өткен кездесулер тарихын: уақытын, тақырыбын және өз жазбаларын көреді.'
            : 'Психолог, который будет с вами работать, увидит ваше имя и историю встреч с ним: когда вы общались, о чём и что он записал по итогам.'}
        </p>
        <p>
          {kk
            ? 'Телефоныңыз психологқа көрсетілмейді. Басқа мамандар кездесу тарихыңызды көрмейді.'
            : 'Ваш телефон психологу не показывается, и другие специалисты вашу историю не видят.'}
        </p>
      </div>

      <div>
        <label
          htmlFor="display-name"
          className="mb-1 block text-xs font-semibold text-muted"
        >
          {kk ? 'Сізге қалай жүгінуге болады' : 'Как к вам обращаться'}
        </label>
        <input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          className="h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-muted">
          {kk
            ? 'Тек атыңызды немесе кез келген атауды көрсетуге болады — құжаттарды тексермейміз'
            : 'Можно указать только имя или любое обращение — документы мы не проверяем'}
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
        {busy
          ? kk
            ? 'Сақталуда…'
            : 'Сохраняем…'
          : kk
            ? 'Жалғастыру'
            : 'Продолжить'}
      </button>
    </form>
  );
}
