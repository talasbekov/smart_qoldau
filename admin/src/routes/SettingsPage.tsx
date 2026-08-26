import { useState } from 'react';
import { totpSetup, totpConfirm, type TotpSetupResponse } from '@/lib/settings';

type Stage = 'idle' | 'setup' | 'confirmed';

export default function SettingsPage() {
  const [stage, setStage] = useState<Stage>('idle');
  const [data, setData] = useState<TotpSetupResponse | null>(null);
  const [code, setCode] = useState('');

  async function handleStart() {
    const result = await totpSetup();
    setData(result);
    setStage('setup');
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    await totpConfirm(code);
    setStage('confirmed');
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold mb-4">Настройки</h1>
      {stage === 'idle' && (
        <button onClick={handleStart} className="bg-sq-primary-dark text-white rounded px-4 py-2">
          Включить 2FA
        </button>
      )}
      {stage === 'setup' && data && (
        <form onSubmit={handleConfirm} className="flex flex-col gap-3">
          <p className="text-sm">
            Секрет: <code>{data.secret}</code>
          </p>
          <p className="text-sm break-all">Ссылка: {data.otpauthUrl}</p>
          <div className="text-sm">
            <p className="font-semibold">Коды восстановления (сохраните — больше не покажутся):</p>
            <ul>
              {data.recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <input
            placeholder="Код из приложения"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="border rounded px-3 py-2"
            required
          />
          <button type="submit" className="bg-sq-primary-dark text-white rounded px-4 py-2">
            Подтвердить
          </button>
        </form>
      )}
      {stage === 'confirmed' && <p className="text-green-700 font-semibold">2FA включена</p>}
    </div>
  );
}
