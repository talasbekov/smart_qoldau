'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitTicket } from '@/lib/api';
import { buildTicketPayload } from '@/lib/ticket';

type Status = 'idle' | 'submitting' | 'sent' | 'error' | 'unknown';

const DRAFT_KEY = 'smartqoldau:support:guest:draft';
const PENDING_KEY = 'smartqoldau:support:guest:pending';

export default function SupportForm() {
  const t = useTranslations('support');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorCode, setErrorCode] = useState<
    'RATE_LIMITED' | 'VALIDATION' | 'UNKNOWN' | null
  >(null);
  const submitting = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as {
          name?: string;
          contact?: string;
          message?: string;
        };
        setName(draft.name ?? '');
        setContact(draft.contact ?? '');
        setMessage(draft.message ?? '');
      }
      if (localStorage.getItem(PENDING_KEY) === 'true') {
        setStatus('unknown');
        setErrorCode('UNKNOWN');
      }
    } catch {
      // Недоступное хранилище не должно блокировать саму форму.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || (!name && !contact && !message)) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, contact, message }));
  }, [contact, hydrated, message, name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || status === 'unknown') return;
    submitting.current = true;
    setStatus('submitting');
    setErrorCode(null);
    const result = await submitTicket(
      buildTicketPayload({ name, contact, message }),
    );
    if (result.ok) {
      setStatus('sent');
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(PENDING_KEY);
    } else {
      setErrorCode(result.error);
      if (result.error === 'UNKNOWN') {
        localStorage.setItem(PENDING_KEY, 'true');
        setStatus('unknown');
      } else {
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
          onChange={(e) => setName(e.target.value)}
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
          onChange={(e) => setContact(e.target.value)}
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
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full resize-y rounded-2xl border border-border px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>
      <button
        type="submit"
        disabled={
          status === 'submitting' || status === 'sent' || status === 'unknown'
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
          {errorCode === 'RATE_LIMITED'
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
