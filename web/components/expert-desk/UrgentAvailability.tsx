'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/generated';
import { deskCopy } from './copy';

type Me = components['schemas']['ExpertMeDto'];
export default function UrgentAvailability({
  initial,
  locale,
}: {
  initial: boolean | null;
  locale: string;
}) {
  const copy = deskCopy(locale);
  const [value, setValue] = useState(initial);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const lock = useRef(false);
  async function update(reload = false) {
    if (lock.current) return;
    lock.current = true;
    setPhase('saving');
    try {
      const me =
        reload || value === null
          ? await apiFetch<Me>('experts/me')
          : await apiFetch<Me>('experts/me/availability', {
              method: 'PATCH',
              body: JSON.stringify({ acceptsUrgent: !value }),
            });
      if (!me) throw new Error('missing availability');
      setValue(me.acceptsUrgent);
      setPhase(reload ? 'idle' : 'saved');
      window.dispatchEvent(new Event('sq:expert-availability-sync'));
    } catch {
      // A lost response may have applied the change. Require a fresh read,
      // never repeat this mutation automatically.
      setValue(null);
      setPhase('error');
    } finally {
      lock.current = false;
    }
  }
  return (
    <section className="mt-8 rounded-2xl border border-border bg-white p-5">
      <h2 className="text-lg font-extrabold text-ink">{copy.urgent}</h2>
      <p className="my-3 text-sm text-muted">{copy.urgentHint}</p>
      {value === null ? (
        <button
          type="button"
          disabled={phase === 'saving'}
          onClick={() => void update(true)}
          className="min-h-11 font-bold text-primary"
        >
          {phase === 'saving' ? copy.saving : copy.retry}
        </button>
      ) : (
        <label className="flex min-h-11 items-center gap-3 font-semibold text-ink">
          <input
            type="checkbox"
            checked={value}
            disabled={phase === 'saving'}
            onChange={() => void update()}
            className="h-5 w-5 accent-primary"
          />
          {copy.urgent}
        </label>
      )}
      {phase === 'saving' || phase === 'saved' ? (
        <p role="status" className="text-sm text-muted">
          {phase === 'saving' ? copy.saving : copy.saved}
        </p>
      ) : null}
      {phase === 'error' ? (
        <p role="alert" className="text-sm text-red-700">
          {copy.saveError}
        </p>
      ) : null}
    </section>
  );
}
