'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitTicket } from '@/lib/api';
import { buildTicketPayload } from '@/lib/ticket';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export default function SupportForm() {
  const t = useTranslations('support');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorCode, setErrorCode] = useState<'RATE_LIMITED' | 'VALIDATION' | 'NETWORK' | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorCode(null);
    const result = await submitTicket(buildTicketPayload({ name, contact, message }));
    if (result.ok) {
      setStatus('sent');
    } else {
      setStatus('error');
      setErrorCode(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-[500px]">
      <input
        placeholder={t('nameField')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-12 border border-border rounded-2xl px-4 text-sm text-ink"
        required
      />
      <input
        placeholder={t('contactField')}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        className="h-12 border border-border rounded-2xl px-4 text-sm text-ink"
        required
      />
      <textarea
        placeholder={t('messageField')}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="border border-border rounded-2xl px-4 py-3 text-sm text-ink resize-none"
        required
      />
      <button
        type="submit"
        disabled={status === 'submitting' || status === 'sent'}
        className="h-12 rounded-full bg-primary text-white font-bold text-sm"
      >
        {status === 'submitting' ? t('submitting') : status === 'sent' ? t('sent') : t('submit')}
      </button>
      {status === 'error' && errorCode && (
        <p className="text-red-600 text-xs">
          {errorCode === 'RATE_LIMITED' ? t('errorRateLimited') : t('errorGeneric')}
        </p>
      )}
    </form>
  );
}
