'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/generated';
import { journeyCopy } from './journey-copy';

type Method = components['schemas']['PaymentMethodDto'];
type Setup = { mode: 'mock' | 'unavailable'; canAddDemo: boolean };

export default function PaymentMethods({
  locale,
  returnTo,
}: {
  locale: string;
  returnTo: string;
}) {
  const copy = journeyCopy(locale);
  const [methods, setMethods] = useState<Method[] | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const load = useCallback(async () => {
    const [cards, capability] = await Promise.all([
      apiFetch<Method[]>('payment-methods'),
      apiFetch<Setup>('payment-methods/setup'),
    ]);
    if (!Array.isArray(cards) || !capability)
      throw new Error('Invalid payment setup');
    setMethods(cards);
    setSetup(capability);
    setUncertain(false);
    setError(false);
  }, []);
  useEffect(() => {
    void load().catch(() => setError(true));
  }, [load]);

  async function act(path?: string, method?: 'POST' | 'DELETE') {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      if (path) await apiFetch(path, { method });
      await load();
    } catch {
      setError(true);
      setUncertain(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="flex max-w-xl flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{copy.methods}</h1>
      {setup && (
        <p className="rounded-2xl bg-chip p-4 text-sm">
          {setup.mode === 'mock' ? copy.demo : copy.unavailable}
        </p>
      )}
      {error && <p role="alert">{copy.error}</p>}
      {methods === null && !error && <p role="status">{copy.loading}</p>}
      {methods?.length === 0 && <p>{copy.empty}</p>}
      <ul className="flex flex-col gap-3">
        {methods?.map((card) => (
          <li
            key={card.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"
          >
            <span>
              {card.brand.toUpperCase()} · {card.maskedPan}
              {card.holderName === 'TEST ONLY' ? ' · TEST ONLY' : ''}
            </span>
            <button
              className="min-h-11 px-3 text-primary disabled:opacity-50"
              disabled={busy || uncertain}
              onClick={() => void act(`payment-methods/${card.id}`, 'DELETE')}
            >
              {copy.remove}
            </button>
          </li>
        ))}
      </ul>
      {setup?.mode === 'mock' && setup.canAddDemo && (
        <button
          disabled={busy || uncertain}
          className="min-h-12 rounded-xl bg-primary px-4 font-bold text-white disabled:opacity-50"
          onClick={() => void act('payment-methods/demo', 'POST')}
        >
          {copy.add}
        </button>
      )}
      <button
        disabled={busy}
        className="min-h-11 rounded-xl border border-border px-4"
        onClick={() => void act()}
      >
        {busy ? copy.loading : copy.retry}
      </button>
      {!busy && !uncertain && (
        <Link
          className="min-h-11 py-3 font-bold text-primary underline"
          href={returnTo}
        >
          {copy.back}
        </Link>
      )}
    </section>
  );
}
