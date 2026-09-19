import { useEffect, useRef, useState } from 'react';
import { totpVerify } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import type { Session } from '@/lib/types';
import { tokenStore } from '@/lib/tokenStore';
import type { SessionSnapshot } from '@/lib/tokenStore';

export default function TotpChallengePage({
  challengeToken,
  onSession,
}: {
  challengeToken: string;
  onSession: (s: Session, expected: SessionSnapshot) => void | Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const attempt = useRef(0);
  useEffect(
    () => () => {
      attempt.current++;
    },
    [],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const sequence = ++attempt.current;
    const expected = tokenStore.snapshot();
    try {
      const session = await totpVerify(challengeToken, code);
      if (sequence !== attempt.current || tokenStore.snapshot() !== expected)
        return;
      await onSession(session, expected);
    } catch (error) {
      if (sequence !== attempt.current) return;
      setError(
        error instanceof Error && !(error instanceof ApiError)
          ? error.message
          : 'Неверный код',
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sq-surface-muted">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl border w-80 flex flex-col gap-3"
      >
        <h1 className="font-bold text-lg mb-2">Код подтверждения</h1>
        <input
          placeholder="Код из приложения"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <button
          type="submit"
          className="bg-sq-primary-dark text-white rounded py-2 font-semibold"
        >
          Подтвердить
        </button>
        {error && <p className="text-sq-danger text-sm">{error}</p>}
      </form>
    </div>
  );
}
