'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api/client';
import ApplicationForm from './ApplicationForm';
import DocumentList from './DocumentList';
import ProfilePhoto from './ProfilePhoto';
import VerificationStatus from './VerificationStatus';
import { expertCopy } from './copy';
import type { ExpertDocument, ExpertMe, Topic } from './types';

export default function ExpertProfile({ locale, topics, initialExpert, initialDocuments }: { locale: string; topics: Topic[]; initialExpert: ExpertMe; initialDocuments: ExpertDocument[] | null }) {
  const copy = expertCopy(locale); const [expert, setExpert] = useState(initialExpert); const [documents, setDocuments] = useState(initialDocuments ?? []);
  const [loadingDocuments, setLoadingDocuments] = useState(initialDocuments === null); const [documentError, setDocumentError] = useState(false);
  const [about, setAbout] = useState(expert.about ?? ''); const [aboutState, setAboutState] = useState<'idle' | 'saving' | 'error'>('idle');
  async function refresh() { try { const fresh = await apiFetch<ExpertMe>('experts/me'); if (fresh) { setExpert(fresh); setAbout(fresh.about ?? ''); } } catch {} }
  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true); setDocumentError(false);
    try { setDocuments((await apiFetch<ExpertDocument[]>('experts/me/documents')) ?? []); }
    catch { setDocumentError(true); } finally { setLoadingDocuments(false); }
  }, []);
  useEffect(() => { if (initialDocuments === null) void loadDocuments(); }, [initialDocuments, loadDocuments]);
  async function saveAbout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (about.trim() && (about.trim().length < 10 || about.trim().length > 1000)) { setAboutState('error'); return; }
    setAboutState('saving'); try { const fresh = await apiFetch<ExpertMe>('experts/me', { method: 'PATCH', body: JSON.stringify({ about: about.trim() }) }); if (fresh) setExpert(fresh); setAboutState('idle'); } catch (caught) { setAboutState('error'); if (caught instanceof ApiError) return; }
  }
  return <div className="flex max-w-4xl flex-col gap-6">
    <h1 className="text-2xl font-extrabold text-ink">{copy.profileTitle}</h1>
    <VerificationStatus locale={locale} expert={expert} />
    <ProfilePhoto locale={locale} expert={expert} onUploaded={() => void refresh()} />
    <ApplicationForm locale={locale} topics={topics} expert={expert} onSaved={setExpert} />
    <form onSubmit={saveAbout} className="rounded-2xl border border-border bg-white p-5"><label className="flex flex-col gap-2 text-sm font-bold text-ink">{copy.about}<textarea value={about} maxLength={1000} onChange={(event) => setAbout(event.target.value)} className="min-h-28 rounded-xl border border-border p-3 font-normal text-body outline-none focus:ring-2 focus:ring-primary" /></label><p className="mt-2 text-sm text-muted">{copy.aboutHint}</p>{aboutState === 'error' && <p role="alert" className="mt-3 text-sm text-[#8a3a2e]">{about.trim().length && about.trim().length < 10 ? copy.aboutHint : copy.genericError}</p>}<button disabled={aboutState === 'saving'} className="mt-4 min-h-11 rounded-full bg-primary px-5 font-bold text-white disabled:opacity-60">{aboutState === 'saving' ? copy.saving : copy.save}</button></form>
    {loadingDocuments ? <p className="rounded-2xl border border-border bg-white p-5 text-body">…</p> : documentError ? <section className="rounded-2xl border border-border bg-white p-5"><p role="alert" className="text-body">{copy.genericError}</p><button type="button" onClick={() => void loadDocuments()} className="mt-3 min-h-11 rounded-full border border-primary px-4 font-bold text-primary">{copy.retry}</button></section> : <DocumentList locale={locale} verificationStatus={expert.verificationStatus} isBlocked={expert.isBlocked} documents={documents} onDocumentsChanged={setDocuments} onSubmitted={(verificationStatus) => setExpert((old) => ({ ...old, verificationStatus: verificationStatus as ExpertMe['verificationStatus'] }))} />}
  </div>;
}
