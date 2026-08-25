import { useState } from 'react';
import { login } from '@/lib/auth';
import type { Session } from '@/lib/types';

export default function LoginPage({
  onSession,
  onTotpChallenge,
}: {
  onSession: (session: Session) => void;
  onTotpChallenge?: (challengeToken: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await login(email, password);
      if (result.kind === 'session') onSession(result.session);
      else onTotpChallenge?.(result.challengeToken);
    } catch {
      setError('Неверный email или пароль');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl border w-80 flex flex-col gap-3">
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
        <button type="submit" className="bg-teal-700 text-white rounded py-2 font-semibold">
          Войти
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
    </div>
  );
}
