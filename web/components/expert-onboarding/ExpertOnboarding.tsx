'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import ApplicationForm from './ApplicationForm';
import DocumentList from './DocumentList';
import VerificationStatus from './VerificationStatus';
import { expertCopy } from './copy';
import type { ExpertDocument, ExpertMe, Topic } from './types';

export default function ExpertOnboarding({ locale, topics, initialExpert }: { locale: string; topics: Topic[]; initialExpert: ExpertMe | null }) {
  const copy = expertCopy(locale);
  const [expert, setExpert] = useState(initialExpert);
  const [documents, setDocuments] = useState<ExpertDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(Boolean(initialExpert));
  const [documentError, setDocumentError] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!expert) return;
    setLoadingDocuments(true); setDocumentError(false);
    try { setDocuments((await apiFetch<ExpertDocument[]>('experts/me/documents')) ?? []); }
    catch { setDocumentError(true); }
    finally { setLoadingDocuments(false); }
  }, [expert]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  useEffect(() => {
    if (!expert || expert.verificationStatus === 'VERIFIED') return;
    let dropped = false;
    async function check() {
      try {
        const fresh = await apiFetch<ExpertMe>('experts/me');
        if (!dropped && fresh) setExpert(old => old && (old.verificationStatus !== fresh.verificationStatus || old.isBlocked !== fresh.isBlocked) ? fresh : old);
      } catch { /* Existing form stays available during a temporary outage. */ }
    }
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void check(); }, 15000);
    return () => { dropped = true; clearInterval(timer); };
  }, [expert]);

  return <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
    <h1 className="text-3xl font-extrabold text-ink">{expert ? copy.existingTitle : copy.title}</h1>
    {!expert && <><p className="mt-2 max-w-2xl text-body">{copy.applicationHint}</p><div className="mt-7"><ApplicationForm locale={locale} topics={topics} onSaved={setExpert} /></div></>}
    {expert && <div className="mt-7 flex flex-col gap-5">
      <VerificationStatus expert={expert} locale={locale} />
      {loadingDocuments ? <p className="rounded-2xl border border-border bg-white p-5 text-body">…</p> : documentError ? <div className="rounded-2xl border border-border bg-white p-5"><p role="alert" className="text-body">{copy.genericError}</p><button onClick={() => void loadDocuments()} className="mt-3 min-h-11 rounded-full border border-primary px-4 font-bold text-primary">{copy.retry}</button></div> : <DocumentList locale={locale} verificationStatus={expert.verificationStatus} isBlocked={expert.isBlocked} documents={documents} onDocumentsChanged={setDocuments} onSubmitted={(verificationStatus) => setExpert((old) => old ? { ...old, verificationStatus: verificationStatus as ExpertMe['verificationStatus'] } : old)} />}
    </div>}
  </main>;
}
