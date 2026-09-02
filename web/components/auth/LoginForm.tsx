'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Тот же формат, что проверяет RequestCodeDto на бэкенде. Проверка здесь
// не защита, а вежливость: не тратить SMS и время человека на заведомо
// неверный номер. Решает всё равно бэкенд.
const PHONE = /^\+77\d{9}$/;

const ERRORS: Record<string, string> = {
  SMS_CODE_INVALID: 'Неверный код. Проверьте SMS и попробуйте ещё раз',
  SMS_CODE_EXPIRED: 'Срок действия кода истёк — запросите новый',
  SMS_RATE_LIMITED: 'Слишком часто. Подождите немного и повторите',
  VALIDATION_FAILED: 'Проверьте номер телефона',
};

function message(code: unknown): string {
  return (typeof code === 'string' && ERRORS[code]) || 'Что-то пошло не так. Попробуйте ещё раз';
}

const FIELD =
  'h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary';
const BUTTON =
  'h-12 w-full rounded-2xl bg-primary text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2';

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    if (!PHONE.test(phone)) {
      setError('Неверный формат номера. Ожидается +77XXXXXXXXX');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (!response.ok) {
        setError(message(((await response.json()) as { code?: string }).code));
        return;
      }
      setStep('code');
    } catch {
      setError(message(null));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      if (!response.ok) {
        setError(message(((await response.json()) as { code?: string }).code));
        return;
      }
      router.refresh();
    } catch {
      setError(message(null));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={step === 'phone' ? requestCode : verify} className="flex w-full max-w-sm flex-col gap-4">
      {step === 'phone' ? (
        <div>
          <label htmlFor="phone" className="mb-1 block text-xs font-semibold text-muted">
            Номер телефона
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+7 701 000 00 00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={FIELD}
          />
        </div>
      ) : (
        <div>
          <label htmlFor="code" className="mb-1 block text-xs font-semibold text-muted">
            Код из SMS
          </label>
          {/* Одно поле, а не шесть клеточек: в клеточки не вставить код и
              не подставить его автозаполнением — WCAG 2.2 «Accessible
              Authentication» прямо это запрещает. */}
          <input
            id="code"
            name="code"
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={FIELD}
          />
          <p className="mt-2 text-xs text-muted">Код отправлен на {phone}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={BUTTON}>
        {busy ? 'Отправляем…' : step === 'phone' ? 'Получить код' : 'Войти'}
      </button>

      {step === 'code' && (
        <button
          type="button"
          onClick={() => {
            setStep('phone');
            setError(null);
          }}
          className="text-sm font-semibold text-primary underline underline-offset-4"
        >
          Изменить номер
        </button>
      )}
    </form>
  );
}
