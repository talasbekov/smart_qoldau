'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitTicket } from '@/lib/api';
import { buildTicketPayload } from '@/lib/ticket';
import {
  createSupportStorage,
  newSupportId,
  purgeLegacySupportStorage,
  type PendingGuest,
} from '@/lib/support-storage';

type Status = 'idle' | 'submitting' | 'sent' | 'error' | 'unknown';
const storage = createSupportStorage('guest');

export default function SupportForm() {
  const t = useTranslations('support');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorCode, setErrorCode] = useState<
    'RATE_LIMITED' | 'VALIDATION' | 'UNKNOWN' | 'STORAGE' | null
  >(null);
  const submitting = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const draftRevision = useRef(newSupportId());
  const lifecycle = useRef(0);

  useEffect(() => {
    const generation = lifecycle.current + 1;
    lifecycle.current = generation;
    purgeLegacySupportStorage();
    const draft = storage.readGuestDraft();
    if (draft.status === 'valid') {
      draftRevision.current = draft.value.revision;
      setName(draft.value.payload.name);
      setContact(draft.value.payload.contact);
      setMessage(draft.value.payload.message);
    } else {
      draftRevision.current = newSupportId();
      if (draft.status === 'unavailable') {
        setStorageAvailable(false);
        setStatus('error');
        setErrorCode('STORAGE');
      }
    }
    const pending = storage.readGuestPending();
    if (pending.status === 'valid') {
      if (draft.status !== 'valid') {
        draftRevision.current = pending.value.draftRevision;
        setName(pending.value.payload.name);
        setContact(pending.value.payload.contact);
        setMessage(pending.value.payload.message);
      }
      setStatus('unknown');
      setErrorCode('UNKNOWN');
    } else if (pending.status === 'corrupt') {
      setStatus('unknown');
      setErrorCode('UNKNOWN');
    } else if (pending.status === 'unavailable') {
      setStorageAvailable(false);
      setStatus('error');
      setErrorCode('STORAGE');
    }
    setHydrated(true);
    return () => {
      if (lifecycle.current === generation) lifecycle.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!name && !contact && !message) {
      storage.removeGuestDraft();
      return;
    }
    const saved = storage.saveGuestDraft({
      revision: draftRevision.current,
      payload: { name, contact, message },
    });
    if (!saved) {
      setStorageAvailable(false);
      setStatus('error');
      setErrorCode('STORAGE');
    }
  }, [contact, hydrated, message, name]);

  function reviseDraft() {
    draftRevision.current = newSupportId();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || status === 'unknown' || !storageAvailable) return;
    const snapshot: PendingGuest = {
      operationId: newSupportId(),
      draftRevision: draftRevision.current,
      payload: { name, contact, message },
    };
    if (!storage.saveGuestPending(snapshot)) {
      setStorageAvailable(false);
      setStatus('error');
      setErrorCode('STORAGE');
      return;
    }
    const generation = lifecycle.current;
    submitting.current = true;
    setStatus('submitting');
    setErrorCode(null);
    const result = await submitTicket(buildTicketPayload(snapshot.payload));
    if (generation !== lifecycle.current) return;
    if (result.ok) {
      setStatus('sent');
      storage.removeGuestPendingIfOperation(snapshot.operationId);
      storage.removeGuestDraftIfRevision(snapshot.draftRevision);
    } else {
      setErrorCode(result.error);
      if (result.error === 'UNKNOWN') {
        setStatus('unknown');
      } else {
        storage.removeGuestPendingIfOperation(snapshot.operationId);
        setStatus('error');
      }
    }
    submitting.current = false;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-[500px] flex-col gap-4">
      <div>
        <label
          htmlFor="guest-support-name"
          className="mb-1 block text-sm font-semibold text-ink-soft"
        >
          {t('nameField')}
        </label>
        <input
          id="guest-support-name"
          placeholder={t('nameField')}
          value={name}
          disabled={status === 'unknown'}
          onChange={(e) => {
            reviseDraft();
            setName(e.target.value);
          }}
          className="h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>
      <div>
        <label
          htmlFor="guest-support-contact"
          className="mb-1 block text-sm font-semibold text-ink-soft"
        >
          {t('contactField')}
        </label>
        <input
          id="guest-support-contact"
          placeholder={t('contactField')}
          value={contact}
          disabled={status === 'unknown'}
          onChange={(e) => {
            reviseDraft();
            setContact(e.target.value);
          }}
          className="h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>
      <div>
        <label
          htmlFor="guest-support-message"
          className="mb-1 block text-sm font-semibold text-ink-soft"
        >
          {t('messageField')}
        </label>
        <textarea
          id="guest-support-message"
          placeholder={t('messageField')}
          value={message}
          disabled={status === 'unknown'}
          onChange={(e) => {
            reviseDraft();
            setMessage(e.target.value);
          }}
          rows={4}
          maxLength={4000}
          className="w-full resize-y rounded-2xl border border-border px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>
      <button
        type="submit"
        disabled={
          status === 'submitting' ||
          status === 'sent' ||
          status === 'unknown' ||
          !storageAvailable
        }
        className="min-h-12 rounded-full bg-primary px-5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'submitting'
          ? t('submitting')
          : status === 'sent'
            ? t('sent')
            : t('submit')}
      </button>
      {status === 'error' && errorCode && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {errorCode === 'STORAGE'
            ? t('errorStorage')
            : errorCode === 'RATE_LIMITED'
              ? t('errorRateLimited')
              : t('errorGeneric')}
        </p>
      )}
      {status === 'unknown' && (
        <p role="alert" className="text-sm font-semibold text-amber-800">
          {t('errorUnknown')}
        </p>
      )}
    </form>
  );
}
