'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectRealtime, type SqSocket } from '@/lib/realtime/socket';
import { apiFetch } from '@/lib/api/client';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const REFRESH_MS = 15_000;

export default function ConsultationStatusRefresh({
  consultationId,
  initialStatus,
  initialPaymentStatus,
  initialFormat,
  locale,
}: {
  consultationId: string;
  initialStatus: string;
  initialPaymentStatus?: string;
  initialFormat?: string;
  locale: string;
}) {
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const { refresh } = useRouter();
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
      const current = await apiFetch<{ status: string; paymentStatus: string; format: string }>(
        `consultations/${consultationId}`,
      );
      if (!mounted.current) return;
      if (current?.status && (current.status !== initialStatus ||
        (initialPaymentStatus !== undefined && current.paymentStatus !== initialPaymentStatus) ||
        (initialFormat !== undefined && current.format !== initialFormat))) {
        if (current.status === 'ACTIVE') {
          window.dispatchEvent(
            new CustomEvent('sq:expert-work-status', { detail: 'BUSY' }),
          );
        }
        refresh();
      }
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      checkLock.current = false;
      if (mounted.current) setChecking(false);
    }
  }, [consultationId, initialStatus, initialPaymentStatus, initialFormat, refresh]);

  useEffect(() => {
    mounted.current = true;
    if (initialStatus !== 'SCHEDULED' && initialStatus !== 'ACTIVE') {
      return () => {
        mounted.current = false;
      };
    }
    let dropped = false;
    let socket: SqSocket | null = null;
    const timer = setInterval(() => void check(), REFRESH_MS);
    void connectRealtime()
      .then((connected) => {
        if (dropped) {
          connected.close();
          return;
        }
        socket = connected;
        connected.on('consultation.updated', (payload) => {
          if (
            !dropped &&
            (payload as { id?: string } | null)?.id === consultationId
          ) {
            void check();
          }
        });
        // Ready fires again after reconnect. REST also covers events missed
        // while the tab was offline; polling remains if socket setup fails.
        connected.onReady(() => {
          if (!dropped) void check();
        });
      })
      .catch(() => undefined);
    return () => {
      dropped = true;
      mounted.current = false;
      clearInterval(timer);
      socket?.close();
    };
  }, [check, initialStatus, consultationId]);

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
