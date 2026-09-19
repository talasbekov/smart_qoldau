'use client';

import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';

// Удаление необратимо (ТЗ §5.1), поэтому подтверждение обязательно и
// последствия названы до нажатия, а не в тексте после.
export default function DeleteAccount({ locale }: { locale: string }) {
  const router = useRouter();
  const copy = locale === 'kz' ? kz.account : ru.account;
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch('me', { method: 'DELETE' });
      // Выход из кабинета сразу: оставаться в интерфейсе удалённого
      // аккаунта — значит показывать ошибки на каждый запрос.
      router.replace(`/${locale}`);
    } catch {
      setError(copy.deleteError);
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-2xl border border-border px-5 py-3 text-sm font-bold text-red-700 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {copy.delete}
      </button>
    );
  }

  return (
    <div className="rounded-[20px] border border-border p-5">
      <p className="mb-2 text-sm font-bold text-ink">{copy.deleteTitle}</p>
      <p className="mb-4 text-sm text-body">{copy.deleteBody}</p>

      {error && (
        <p role="alert" className="mb-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-2xl bg-red-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {busy ? copy.deleting : copy.confirmDelete}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-2xl border border-border px-5 py-3 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {copy.cancel}
        </button>
      </div>
    </div>
  );
}
