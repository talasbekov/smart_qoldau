'use client';

import { RoomEvent, Track } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import {
  CallError,
  joinCall,
  type Call,
  type CallState,
} from '@/lib/realtime/call';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import DeviceCheck, { type Chosen } from './DeviceCheck';
import Chat from './Chat';

const CONTROL =
  'min-h-12 rounded-2xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2';

function errorCopy(caught: unknown, copy: (typeof ru)['session']): string {
  if (!(caught instanceof CallError)) return copy.connectionError;
  switch (caught.reason) {
    case 'not-active':
      return copy.notActive;
    case 'payment-required':
      return copy.paymentRequired;
    case 'permission-denied':
      return copy.permissionDenied;
    case 'device-missing':
      return copy.deviceUnavailable;
    default:
      return copy.connectionError;
  }
}

export default function Session({
  consultationId,
  format,
  locale = 'ru',
  senderRole = 'client',
}: {
  consultationId: string;
  format: 'audio' | 'video';
  locale?: string;
  senderRole?: 'client' | 'expert';
}) {
  const copy = locale === 'kz' ? kz.session : ru.session;
  const [call, setCall] = useState<Call | null>(null);
  const [peerPresent, setPeerPresent] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [callState, setCallState] = useState<CallState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [controlBusy, setControlBusy] = useState<'mic' | 'camera' | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(format === 'video');
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mountedRef = useRef(true);
  const pendingJoinRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingJoinRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!call || !audioRef.current) return;

    const unbind = call.bindRemoteMedia({
      audio: audioRef.current,
      video: format === 'video' ? videoRef.current : null,
    });
    const unsubscribe = call.onStateChange((next) => {
      if (!mountedRef.current) return;
      setCallState(next);
      if (next === 'connected') setError(null);
      if (next === 'disconnected') {
        setCall((current) => (current === call ? null : current));
        setError(copy.disconnected);
      }
    });

    return () => {
      unbind();
      unsubscribe();
      void call.leave();
    };
  }, [call, copy.disconnected, format]);

  useEffect(() => {
    if (!call) { setPeerPresent(false); return; }
    const updatePeer = () => setPeerPresent(call.room.remoteParticipants.size > 0);
    updatePeer();
    call.room.on(RoomEvent.ParticipantConnected, updatePeer);
    call.room.on(RoomEvent.ParticipantDisconnected, updatePeer);
    const localVideo = localVideoRef.current;
    const track = call.room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (localVideo && track) track.attach(localVideo);
    return () => {
      call.room.off(RoomEvent.ParticipantConnected, updatePeer);
      call.room.off(RoomEvent.ParticipantDisconnected, updatePeer);
      if (localVideo && track) track.detach(localVideo);
    };
  }, [call, cameraOn]);

  async function connect(devices: Chosen) {
    if (connecting || pendingJoinRef.current) return;
    const controller = new AbortController();
    pendingJoinRef.current = controller;
    setError(null);
    setConnecting(true);
    try {
      const joined = await joinCall(
        consultationId,
        format,
        devices,
        controller.signal,
      );
      if (!mountedRef.current) {
        await joined.leave();
        return;
      }
      setMicOn(true);
      setCameraOn(format === 'video');
      setCall(joined);
    } catch (caught) {
      if (mountedRef.current) setError(errorCopy(caught, copy));
    } finally {
      if (pendingJoinRef.current === controller) {
        pendingJoinRef.current = null;
      }
      if (mountedRef.current) setConnecting(false);
    }
  }

  async function toggleMic() {
    if (!call || controlBusy) return;
    const next = !micOn;
    setError(null);
    setControlBusy('mic');
    try {
      await call.room.localParticipant.setMicrophoneEnabled(next);
      if (mountedRef.current) setMicOn(next);
    } catch {
      if (mountedRef.current) setError(copy.micControlError);
    } finally {
      if (mountedRef.current) setControlBusy(null);
    }
  }

  async function toggleCamera() {
    if (!call || controlBusy) return;
    const next = !cameraOn;
    setError(null);
    setControlBusy('camera');
    try {
      await call.room.localParticipant.setCameraEnabled(next);
      if (mountedRef.current) setCameraOn(next);
    } catch {
      if (mountedRef.current) setError(copy.cameraControlError);
    } finally {
      if (mountedRef.current) setControlBusy(null);
    }
  }

  async function leave() {
    if (!call || leaving) return;
    const activeCall = call;
    setError(null);
    setLeaving(true);
    try {
      await activeCall.leave();
      if (!mountedRef.current) return;
      setCall((current) => (current === activeCall ? null : current));
    } catch {
      if (mountedRef.current) setError(copy.connectionError);
    } finally {
      if (mountedRef.current) setLeaving(false);
    }
  }

  return (
    // Видео и чат рядом на широком экране, одно под другим на узком.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        {!call && !connecting ? (
          <DeviceCheck format={format} locale={locale} onJoin={connect} />
        ) : null}

        {connecting ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-2xl bg-chip p-4 text-sm text-body"
          >
            {copy.connecting}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-2xl bg-chip p-4 text-sm text-body">
            {error}
          </p>
        ) : null}

        {call ? (
          <>
            <audio ref={audioRef} autoPlay aria-label={copy.remoteAudio} />
            {format === 'video' ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                aria-label={copy.remoteVideo}
                className="aspect-video w-full rounded-[20px] bg-ink object-cover"
              />
            ) : (
              <div className="flex min-h-52 items-center justify-center rounded-[20px] bg-ink p-6 text-center text-white">
                <div>
                  <p className="text-lg font-extrabold">
                    {peerPresent ? (locale === 'kz' ? 'Қатысушы қосылды' : 'Собеседник подключён') : (locale === 'kz' ? 'Қатысушыны күту' : 'Ожидаем собеседника')}
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    {peerPresent ? (locale === 'kz' ? 'Микрофон арқылы сөйлесе аласыз' : 'Можно говорить через микрофон') : copy.audioWaiting}
                  </p>
                </div>
              </div>
            )}

            {format === 'video' && <div className="flex flex-wrap items-center gap-3">
              <video ref={localVideoRef} autoPlay muted playsInline aria-label={locale === 'kz' ? 'Сіздің камераңыз' : 'Ваша камера'} className="aspect-video w-40 rounded-xl bg-ink object-cover" />
              <p role="status" className="text-sm text-body">{peerPresent ? (locale === 'kz' ? 'Қатысушы қосылды' : 'Собеседник подключён') : (locale === 'kz' ? 'Қатысушыны күту' : 'Ожидаем подключения собеседника')}</p>
            </div>}
            {callState === 'reconnecting' ? (
              <p
                role="status"
                aria-live="polite"
                className="rounded-2xl bg-chip p-4 text-sm font-semibold text-body"
              >
                {copy.reconnecting}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={controlBusy !== null || leaving}
                onClick={() => void toggleMic()}
                aria-pressed={micOn}
                className={`${CONTROL} bg-chip text-ink aria-[pressed=false]:bg-ink aria-[pressed=false]:text-white`}
              >
                {micOn ? copy.micOn : copy.micOff}
              </button>
              {format === 'video' ? (
                <button
                  type="button"
                  disabled={controlBusy !== null || leaving}
                  onClick={() => void toggleCamera()}
                  aria-pressed={cameraOn}
                  className={`${CONTROL} bg-chip text-ink aria-[pressed=false]:bg-ink aria-[pressed=false]:text-white`}
                >
                  {cameraOn ? copy.cameraOn : copy.cameraOff}
                </button>
              ) : null}
              <button
                type="button"
                disabled={leaving}
                onClick={() => void leave()}
                className={`${CONTROL} bg-red-700 text-white`}
              >
                {leaving ? copy.leaving : copy.leave}
              </button>
            </div>
          </>
        ) : null}
      </div>

      <aside className="min-w-0 rounded-[20px] border border-border bg-white p-4">
        <Chat
          consultationId={consultationId}
          locale={locale}
          senderRole={senderRole}
        />
      </aside>
    </div>
  );
}
