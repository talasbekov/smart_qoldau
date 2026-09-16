'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const REFRESH_MS = 15_000;

export default function ConsultationStatusRefresh({
  consultationId,
  initialStatus,
  locale,
}: {
  consultationId: string;
  initialStatus: string;
  locale: string;
}) {
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const router = useRouter();
  const mounted = useRef(true);
  const checkLock = useRef(false);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  const check = useCallback(async () => {
    if (checkLock.current) return;
    checkLock.current = true;
    setChecking(true);
    setFailed(false);
    try {
      const current = await apiFetch<{ status: string }>(
        `consultations/${consultationId}`,
      );
      if (!mounted.current) return;
      if (current?.status && current.status !== initialStatus) router.refresh();
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      checkLock.current = false;
      if (mounted.current) setChecking(false);
    }
  }, [consultationId, initialStatus, router]);

  useEffect(() => {
    mounted.current = true;
    if (initialStatus !== 'SCHEDULED') return;
    const timer = setInterval(() => void check(), REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [check, initialStatus]);

  if (initialStatus !== 'SCHEDULED') return null;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-white p-4">
      <p className="text-sm text-body">{copy.statusAutoRefresh}</p>
      {failed ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
          {copy.statusRefreshError}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void check()}
        disabled={checking}
        className="mt-2 min-h-11 rounded-xl px-3 py-2 text-sm font-bold text-primary disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {checking ? copy.checkingStatus : copy.checkStatus}
      </button>
    </div>
  );
}
