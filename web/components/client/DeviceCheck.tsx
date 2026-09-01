'use client';

import { useEffect, useState } from 'react';
import { listDevices, DeviceError, type Devices } from '@/lib/realtime/devices';

export type Chosen = { cameraId: string | null; microphoneId: string | null };

const REASONS: Record<string, string> = {
  denied: 'Браузер не дал доступ к камере и микрофону. Разрешите его в адресной строке — или можно продолжить в чате',
  missing: 'Камеру или микрофон не нашли. Проверьте, подключены ли они — или можно продолжить в чате',
  unsupported: 'Этот браузер не умеет видеозвонки. Можно продолжить в чате',
  unknown: 'Не удалось получить доступ к устройствам. Можно продолжить в чате',
};

// Выбор устройств ДО входа в комнату: после входа человек уже в разговоре,
// и «сейчас, я не тот микрофон выбрал» — плохое начало консультации.
export default function DeviceCheck({
  format,
  onJoin,
}: {
  format: 'audio' | 'video';
  onJoin: (chosen: Chosen) => void;
}) {
  const [devices, setDevices] = useState<Devices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [microphoneId, setMicrophoneId] = useState<string | null>(null);

  useEffect(() => {
    let dropped = false;

    void listDevices()
      .then((found) => {
        if (dropped) return;
        setDevices(found);
        setCameraId(found.cameras[0]?.id ?? null);
        setMicrophoneId(found.microphones[0]?.id ?? null);
      })
      .catch((caught) => {
        if (dropped) return;
        const reason = caught instanceof DeviceError ? caught.reason : 'unknown';
        setError(REASONS[reason] ?? REASONS.unknown);
      });

    return () => {
      dropped = true;
    };
  }, []);

  return (
    <div className="flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-extrabold text-ink">Проверьте камеру и микрофон</h2>

      {error ? (
        <p role="alert" className="rounded-2xl bg-chip p-4 text-sm text-body">
          {error}
        </p>
      ) : (
        <>
          {format === 'video' && (
            <div>
              <label htmlFor="camera" className="mb-1 block text-xs font-semibold text-muted">
                Камера
              </label>
              <select
                id="camera"
                value={cameraId ?? ''}
                onChange={(e) => setCameraId(e.target.value)}
                className="h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {(devices?.cameras ?? []).map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="microphone" className="mb-1 block text-xs font-semibold text-muted">
              Микрофон
            </label>
            <select
              id="microphone"
              value={microphoneId ?? ''}
              onChange={(e) => setMicrophoneId(e.target.value)}
              className="h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(devices?.microphones ?? []).map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <button
        type="button"
        disabled={!devices}
        onClick={() => onJoin({ cameraId, microphoneId })}
        className="h-12 rounded-2xl bg-primary text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Подключиться
      </button>
    </div>
  );
}
