'use client';

import { useRef, useState } from 'react';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import { changeSession } from '@/lib/auth/browser-session';
import { useRouter } from 'next/navigation';
import { clearAllSupportStorage } from '@/lib/support-storage';

export default function LogoutButton({ locale }: { locale: string }) {
  const router = useRouter();
  const copy = locale === 'kz' ? kz.account : ru.account;
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function logout() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      const response = await changeSession('/api/auth/logout', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Logout rejected');
      clearAllSupportStorage();
      router.replace(`/${locale}`);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="rounded-2xl border border-border px-5 py-3 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {busy ? copy.loggingOut : copy.logout}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {copy.logoutError}
        </p>
      )}
    </div>
  );
}
