'use client';

import { useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { sessionFetch } from '@/lib/auth/browser-session';
import { expertCopy } from './copy';
import { documentNames, documentTypes, type DocumentType, type ExpertDocument } from './types';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function errorCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

async function upload(type: DocumentType, file: File): Promise<ExpertDocument> {
  const form = new FormData(); form.set('file', file);
  const response = await sessionFetch(`/api/proxy/experts/me/documents/${type}`, { method: 'POST', body: form });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (payload as { error?: { code?: string }; code?: string } | null)?.error?.code ?? (payload as { code?: string } | null)?.code ?? null;
    throw new ApiError(response.status, code);
  }
  return payload as ExpertDocument;
}

export default function DocumentList({
  locale, verificationStatus, isBlocked = false, documents, onDocumentsChanged, onSubmitted,
}: {
  locale: string; verificationStatus: string; isBlocked?: boolean; documents: ExpertDocument[];
  onDocumentsChanged: (documents: ExpertDocument[]) => void; onSubmitted: (verificationStatus: string) => void;
}) {
  const copy = expertCopy(locale);
  const [busy, setBusy] = useState<DocumentType | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({});
  const byType = new Map(documents.map((document) => [document.type as DocumentType, document]));
  // The owner may replace a document after verification; the API records the
  // new document state. A pending review and a blocked profile remain read-only.
  const canEdit = !isBlocked && verificationStatus !== 'PENDING';
  const complete = documentTypes.every((type) => ['UPLOADED', 'APPROVED'].includes(byType.get(type)?.status ?? ''));

  async function choose(type: DocumentType, file?: File) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setError(copy.documentHint); return;
    }
    setBusy(type); setError(null);
    try {
      const saved = await upload(type, file);
      onDocumentsChanged(documentTypes.map((kind) => kind === type ? saved : byType.get(kind) ?? { type: kind, status: null }));
    } catch (caught) {
      setError(errorCode(caught) === 'VALIDATION_FAILED' ? copy.documentHint : copy.genericError);
    } finally { setBusy(null); }
  }

  async function submit() {
    setBusy('submit'); setError(null);
    try {
      const result = await apiFetch<{ verificationStatus: string }>('experts/me/documents/submit', { method: 'POST' });
      onSubmitted(result?.verificationStatus ?? 'PENDING');
    } catch (caught) {
      setError(errorCode(caught) === 'DOCUMENTS_INCOMPLETE' ? copy.draftText : copy.genericError);
    } finally { setBusy(null); }
  }

  return <section className="max-w-3xl rounded-2xl border border-border bg-white p-5 sm:p-7">
    <h2 className="text-xl font-extrabold text-ink">{copy.documents}</h2><p className="mt-1 text-sm text-muted">{copy.documentHint}</p>
    {error && <div role="alert" className="mt-4 rounded-xl bg-[#fdece3] p-3 text-sm font-semibold text-[#8a3a2e]">{error} <button type="button" onClick={() => setError(null)} className="ml-2 underline">{copy.retry}</button></div>}
    <ul className="mt-5 flex flex-col gap-3">
      {documentTypes.map((type) => {
        const document = byType.get(type); const status = document?.status;
        const needsReupload = status === 'REUPLOAD_REQUIRED';
        const name = documentNames[type][locale === 'kz' ? 'kz' : 'ru'];
        const label = needsReupload ? copy.reupload : status === 'APPROVED' || status === 'UPLOADED' ? copy.uploaded : copy.notUploaded;
        return <li key={type} className="rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-ink">{name}</p><p className={`mt-1 text-sm ${needsReupload ? 'text-[#8a3a2e]' : 'text-muted'}`}>{label}</p></div>
            <input ref={(node) => { inputs.current[type] = node; }} onChange={(event) => void choose(type, event.target.files?.[0])} accept="application/pdf,image/jpeg,image/png" type="file" className="sr-only" disabled={!canEdit || busy !== null} />
            {canEdit && <button type="button" disabled={busy !== null} onClick={() => inputs.current[type]?.click()} className="min-h-11 rounded-full border border-primary px-4 text-sm font-bold text-primary disabled:opacity-60">{busy === type ? copy.uploading : needsReupload ? copy.reupload : copy.upload}</button>}
          </div>
          {needsReupload && <p className="mt-3 text-sm text-[#8a3a2e]">{document?.comment || copy.rejectedReasonUnavailable}</p>}
        </li>;
      })}
    </ul>
    {verificationStatus === 'DRAFT' && !isBlocked && <button type="button" disabled={!complete || busy !== null} onClick={() => void submit()} className="mt-6 min-h-11 rounded-full bg-primary px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy === 'submit' ? copy.submitting : copy.submit}</button>}
  </section>;
}
