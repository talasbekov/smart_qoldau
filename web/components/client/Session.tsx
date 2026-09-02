'use client';

import { useState } from 'react';
import { joinCall, type Call } from '@/lib/realtime/call';
import DeviceCheck, { type Chosen } from './DeviceCheck';
import Chat from './Chat';

const CONTROL =
  'rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2';

export default function Session({
  consultationId,
  format,
}: {
  consultationId: string;
  format: 'audio' | 'video';
}) {
  const [call, setCall] = useState<Call | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(format === 'video');

  async function connect(devices: Chosen) {
    setError(null);
    try {
      setCall(await joinCall(consultationId, format, devices));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось подключиться');
    }
  }

  async function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    await call?.room.localParticipant.setMicrophoneEnabled(next);
  }

  async function toggleCamera() {
    const next = !cameraOn;
    setCameraOn(next);
    await call?.room.localParticipant.setCameraEnabled(next);
  }

  return (
    // Видео и чат рядом на широком экране, одно под другим на узком:
    // уходить с экрана видео, чтобы прочитать сообщение, одинаково плохо
    // обеим сторонам разговора (правило принято в E14).
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        {!call && !error && <DeviceCheck format={format} onJoin={connect} />}

        {error && (
          <div>
            <p role="alert" className="mb-3 rounded-2xl bg-chip p-4 text-sm text-body">
              {error}
            </p>
            <DeviceCheck format={format} onJoin={connect} />
          </div>
        )}

        {call && (
          <>
            <div
              className="aspect-video w-full rounded-[20px] bg-ink"
              aria-label="Видео собеседника"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={micOn}
                className={`${CONTROL} bg-chip text-ink aria-[pressed=false]:bg-ink aria-[pressed=false]:text-white`}
              >
                {micOn ? 'Микрофон включён' : 'Микрофон выключен'}
              </button>
              {format === 'video' && (
                <button
                  type="button"
                  onClick={toggleCamera}
                  aria-pressed={cameraOn}
                  className={`${CONTROL} bg-chip text-ink aria-[pressed=false]:bg-ink aria-[pressed=false]:text-white`}
                >
                  {cameraOn ? 'Камера включена' : 'Камера выключена'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  void call.leave();
                  setCall(null);
                }}
                className={`${CONTROL} bg-red-700 text-white`}
              >
                Завершить
              </button>
            </div>
          </>
        )}
      </div>

      <aside className="rounded-[20px] border border-border bg-white p-4">
        <Chat consultationId={consultationId} />
      </aside>
    </div>
  );
}
