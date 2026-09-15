'use client';

import { useEffect, useState } from 'react';
import { listDevices, DeviceError, type Devices } from '@/lib/realtime/devices';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

export type Chosen = { cameraId: string | null; microphoneId: string | null };

// Выбор устройств ДО входа в комнату: после входа человек уже в разговоре,
// и «сейчас, я не тот микрофон выбрал» — плохое начало консультации.
export default function DeviceCheck({
  format,
  locale = 'ru',
  onJoin,
}: {
  format: 'audio' | 'video';
  locale?: string;
  onJoin: (chosen: Chosen) => void;
}) {
  const copy = locale === 'kz' ? kz.session : ru.session;
  const [devices, setDevices] = useState<Devices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [microphoneId, setMicrophoneId] = useState<string | null>(null);

  useEffect(() => {
    let dropped = false;

    void listDevices(format)
      .then((found) => {
        if (dropped) return;
        if (
          found.microphones.length === 0 ||
          (format === 'video' && found.cameras.length === 0)
        ) {
          setError(copy.deviceMissing);
          return;
        }
        setDevices(found);
        setCameraId(found.cameras[0]?.id ?? null);
        setMicrophoneId(found.microphones[0]?.id ?? null);
      })
      .catch((caught) => {
        if (dropped) return;
        const reason = caught instanceof DeviceError ? caught.reason : 'unknown';
        const reasons = {
          denied: copy.deviceDenied,
          missing: copy.deviceMissing,
          unsupported: copy.deviceUnsupported,
          unknown: copy.deviceUnknown,
        };
        setError(reasons[reason] ?? reasons.unknown);
      });

    return () => {
      dropped = true;
    };
  }, [copy.deviceDenied, copy.deviceMissing, copy.deviceUnknown, copy.deviceUnsupported, format]);

  return (
    <div className="flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-extrabold text-ink">{copy.deviceTitle}</h2>

      {error ? (
        <p role="alert" className="rounded-2xl bg-chip p-4 text-sm text-body">
          {error}
        </p>
      ) : (
        <>
          {format === 'video' && (
            <div>
              <label htmlFor="camera" className="mb-1 block text-xs font-semibold text-muted">
                {copy.camera}
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
              {copy.microphone}
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
        {copy.join}
      </button>
    </div>
  );
}
