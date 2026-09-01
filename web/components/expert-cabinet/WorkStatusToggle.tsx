'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';

// Бэкенд считает эксперта доступным, пока свежий heartbeat (presence в
// Redis). В приложении его шлёт фоновая служба; в браузере такой службы
// нет и быть не может — вкладку закрывают, ноутбук захлопывают.
const HEARTBEAT_MS = 30_000;

export default function WorkStatusToggle({
  initial,
}: {
  initial: 'ACCEPTING' | 'BUSY' | 'NOT_ACCEPTING' | 'UNAVAILABLE';
}) {
  const [accepting, setAccepting] = useState(initial === 'ACCEPTING');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (timer.current) return;
    timer.current = setInterval(() => {
      void apiFetch('experts/me/heartbeat', { method: 'POST' }).catch(() => null);
    }, HEARTBEAT_MS);
  }, []);

  useEffect(() => {
    // Онлайн честный: heartbeat идёт только пока вкладка видима. Иначе
    // клиенту предлагают эксперта, которого нет за компьютером, и он
    // ждёт ответа от закрытого браузера.
    function sync() {
      if (accepting && document.visibilityState === 'visible') start();
      else stop();
    }

    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      stop();
    };
  }, [accepting, start, stop]);

  async function toggle() {
    const next = !accepting;
    setAccepting(next);
    await apiFetch('experts/me/work-status', {
      method: 'PATCH',
      body: JSON.stringify({ workStatus: next ? 'ACCEPTING' : 'NOT_ACCEPTING' }),
    }).catch(() => null);
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={accepting}
        onClick={toggle}
        className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span
          aria-hidden="true"
          className={`h-3 w-3 rounded-full ${accepting ? 'bg-primary' : 'bg-faint'}`}
        />
        {accepting ? 'Принимаю клиентов' : 'Не принимаю'}
      </button>
      <p className="text-xs text-muted">
        Пока вкладка открыта — вы на связи. Закроете — заявки перестанут приходить.
      </p>
    </div>
  );
}
