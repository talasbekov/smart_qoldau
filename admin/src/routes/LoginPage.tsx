import { useEffect, useRef, useState } from 'react';
import { login } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import type { Session } from '@/lib/types';
import { tokenStore } from '@/lib/tokenStore';
import type { SessionSnapshot } from '@/lib/tokenStore';

export default function LoginPage({
  onSession,
  onTotpChallenge,
}: {
  onSession: (
    session: Session,
    expected: SessionSnapshot,
  ) => void | Promise<void>;
  onTotpChallenge?: (challengeToken: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const result = await login(email, password);
      if (sequence !== attempt.current || tokenStore.snapshot() !== expected)
        return;
      if (result.kind === 'session') await onSession(result.session, expected);
      else onTotpChallenge?.(result.challengeToken);
    } catch (error) {
      if (sequence !== attempt.current) return;
      setError(
        error instanceof Error && !(error instanceof ApiError)
          ? error.message
          : 'Неверный email или пароль',
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sq-surface-muted">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl border w-80 flex flex-col gap-3"
      >
        <h1 className="font-bold text-lg mb-2">SmartQoldau Admin</h1>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <input
          placeholder="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <button
          type="submit"
          className="bg-sq-primary-dark text-white rounded py-2 font-semibold"
        >
          Войти
        </button>
        {error && <p className="text-sq-danger text-sm">{error}</p>}
      </form>
    </div>
  );
}
