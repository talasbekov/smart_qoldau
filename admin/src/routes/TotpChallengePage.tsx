import { useState } from 'react';
import { totpVerify } from '@/lib/auth';
import type { Session } from '@/lib/types';

export default function TotpChallengePage({
  challengeToken,
  onSession,
}: {
  challengeToken: string;
  onSession: (s: Session) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const session = await totpVerify(challengeToken, code);
      onSession(session);
    } catch {
      setError('Неверный код');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl border w-80 flex flex-col gap-3">
        <h1 className="font-bold text-lg mb-2">Код подтверждения</h1>
        <input
          placeholder="Код из приложения"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <button type="submit" className="bg-teal-700 text-white rounded py-2 font-semibold">
          Подтвердить
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
    </div>
  );
}
