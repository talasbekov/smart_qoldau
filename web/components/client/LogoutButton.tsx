'use client';

import { useRouter } from 'next/navigation';
import { clearAllSupportStorage } from '@/lib/support-storage';

export default function LogoutButton({ locale }: { locale: string }) {
  const router = useRouter();

  async function logout() {
    // Cookie снимает сервер: браузеру они недоступны, и «выйти» без
    // обращения к серверу невозможно — это цена httpOnly и она честная.
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    clearAllSupportStorage();
    router.replace(`/${locale}`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-2xl border border-border px-5 py-3 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary"
    >
      Выйти
    </button>
  );
}
