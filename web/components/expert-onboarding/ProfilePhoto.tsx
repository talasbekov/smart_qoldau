'use client';

import { useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { sessionFetch } from '@/lib/auth/browser-session';
import { expertCopy } from './copy';
import type { ExpertMe } from './types';

export default function ProfilePhoto({ locale, expert, onUploaded }: { locale: string; expert: ExpertMe; onUploaded: () => void }) {
  const copy = expertCopy(locale); const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function select(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError(copy.photoRejected); return; }
    const form = new FormData(); form.set('file', file); setBusy(true); setError(null);
    try {
      const response = await sessionFetch('/api/proxy/experts/me/photo', { method: 'POST', body: form });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const code = (payload as { error?: { code?: string } } | null)?.error?.code ?? null;
        throw new ApiError(response.status, code);
      }
      onUploaded();
    } catch { setError(copy.genericError); } finally { setBusy(false); }
  }
  const pending = expert.photoStatus === 'PENDING'; const rejected = expert.photoStatus === 'REJECTED';
  return <section className="rounded-2xl border border-border bg-white p-5">
    <h2 className="font-extrabold text-ink">{copy.photo}</h2>
    <div className="mt-3 flex flex-wrap items-center gap-4">
      {expert.photoUrl ? <img src={expert.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-sm text-muted">—</div>}
      <div><input ref={input} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={(event) => void select(event.target.files?.[0])} disabled={busy} />
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="min-h-11 rounded-full border border-primary px-4 text-sm font-bold text-primary disabled:opacity-60">{busy ? copy.uploading : copy.uploadPhoto}</button>
        {pending && <p className="mt-2 text-sm text-muted">{copy.photoPending}</p>}{rejected && <p className="mt-2 text-sm text-[#8a3a2e]">{expert.moderationComment || copy.photoRejected}</p>}
      </div>
    </div>{error && <p role="alert" className="mt-3 text-sm text-[#8a3a2e]">{error}</p>}
  </section>;
}
