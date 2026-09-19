'use client';

import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import { useEffect, useState } from 'react';
import { changeSession } from '@/lib/auth/browser-session';
import { navigateAfterLogin } from './navigation';
import { validatedConsultationReturnTo } from '@/lib/auth/return-to';

// Тот же формат, что проверяет RequestCodeDto на бэкенде. Проверка здесь
// не защита, а вежливость: не тратить SMS и время человека на заведомо
// неверный номер. Решает всё равно бэкенд.
const PHONE = /^\+77\d{9}$/;

const FIELD =
  'h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary';
const BUTTON =
  'h-12 w-full rounded-2xl bg-primary text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2';

export default function LoginForm({
  locale,
  returnTo,
}: {
  locale: string;
  returnTo?: string;
}) {
  const copy = locale === 'kz' ? kz.loginForm : ru.loginForm;
  function message(code: unknown): string {
    const errors: Record<string, string> = {
      SMS_CODE_INVALID: copy.invalidCode,
      SMS_CODE_EXPIRED: copy.expiredCode,
      SMS_RATE_LIMITED: copy.rateLimited,
      VALIDATION_FAILED: copy.validationFailed,
    };
    return (typeof code === 'string' && errors[code]) || copy.error;
  }
  const [demoPhones, setDemoPhones] = useState<string[]>([]);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void fetch('/api/auth/demo-config').then(r => r.ok ? r.json() : null)
      .then((value: { enabled?: boolean; phones?: string[] } | null) => {
        if (alive && value?.enabled && Array.isArray(value.phones)) setDemoPhones(value.phones);
      }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    if (!PHONE.test(phone)) {
      setError(copy.invalidPhone);
      return;
    }

    setError(null);
    setBusy(true);
    setDemoCode(null);
    try {
      const demo = demoPhones.includes(phone);
      const response = await fetch(demo ? '/api/auth/demo-request-code' : '/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (!response.ok) {
        setError(message((await response.json()).error?.code));
        return;
      }
      if (demo) {
        const payload = await response.json() as { demoCode?: string };
        setDemoCode(payload.demoCode ?? null);
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
    let navigating = false;
    try {
      const response = await changeSession('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      if (!response.ok) {
        setError(message((await response.json()).error?.code));
        return;
      }
      const payload = (await response.json()) as { cabinet?: string };
      navigating = true;
      // Login может быть статически пререндерен, поэтому query читаем при
      // действии в браузере: серверный prop не всегда содержит его после
      // клиентской навигации.
      const queryReturnTo =
        typeof window === 'undefined'
          ? undefined
          : (new URLSearchParams(window.location.search).get('returnTo') ??
            undefined);
      const continuation = validatedConsultationReturnTo(
        returnTo ?? queryReturnTo,
        locale,
      );
      navigateAfterLogin(
        continuation ?? (payload.cabinet === 'expert' ? `/${locale}/expert` : `/${locale}/profile`),
      );
    } catch {
      setError(message(null));
    } finally {
      // После успешного входа форма остаётся заблокированной, пока Next
      // начинает замену маршрута: так один OTP не уходит повторно.
      if (!navigating) setBusy(false);
    }
  }

  return (
    <form
      onSubmit={step === 'phone' ? requestCode : verify}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      {demoPhones.length > 0 && <aside className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink">
        <p className="font-bold">{locale === 'kz' ? 'Тестілік орта' : 'Тестовый стенд'}</p>
        <p className="mt-1">{locale === 'kz' ? 'Төмендегі нөмірлер — ортақ тестілік аккаунттар. Код экранда көрсетіледі. Жеке деректерді енгізбеңіз.' : 'Номера ниже — общие тестовые аккаунты. Код для них появится на экране. Не вводите личные данные.'}</p>
        {step === 'phone' && <div className="mt-2 flex flex-wrap gap-2">{demoPhones.map(number => <button key={number} type="button" onClick={() => setPhone(number)} className="min-h-11 rounded-lg border border-amber-300 px-2 font-semibold">{number}</button>)}</div>}
      </aside>}
      {step === 'phone' ? (
        <div>
          <label
            htmlFor="phone"
            className="mb-1 block text-xs font-semibold text-muted"
          >
            {copy.phone}
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
          <label
            htmlFor="code"
            className="mb-1 block text-xs font-semibold text-muted"
          >
            {copy.code}
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
          <p className="mt-2 text-xs text-muted">
            {copy.codeSent} {phone}
          </p>
        </div>
      )}

      {demoCode && step === 'code' && <p role="status" className="rounded-xl bg-amber-50 p-3 font-bold">{locale === 'kz' ? 'Тест коды' : 'Тестовый код'}: <span>{demoCode}</span></p>}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={BUTTON}>
        {busy ? copy.sending : step === 'phone' ? copy.requestCode : copy.login}
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
          {copy.changePhone}
        </button>
      )}
    </form>
  );
}
