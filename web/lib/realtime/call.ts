import { sessionFetch } from '@/lib/auth/browser-session';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
} from 'livekit-client';
import type { Chosen } from '@/components/client/DeviceCheck';

export type CallState = 'connected' | 'reconnecting' | 'disconnected';
export type CallErrorReason =
  | 'not-active'
  | 'payment-required'
  | 'permission-denied'
  | 'device-missing'
  | 'connection'
  | 'unknown';

export class CallError extends Error {
  constructor(readonly reason: CallErrorReason) {
    super(reason);
    this.name = 'CallError';
  }
}

export type RemoteMediaTargets = {
  audio: HTMLAudioElement;
  video?: HTMLVideoElement | null;
};

export type Call = {
  room: Room;
  bindRemoteMedia: (targets: RemoteMediaTargets) => () => void;
  leave: () => Promise<void>;
  onStateChange: (handler: (state: CallState) => void) => () => void;
  onDisconnected: (handler: () => void) => () => void;
};

type Grant = { token: string; url: string; room: string };

function classifyCallError(caught: unknown): CallError {
  if (caught instanceof CallError) return caught;

  const name = caught instanceof Error ? caught.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new CallError('permission-denied');
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new CallError('device-missing');
  }
  if (caught instanceof TypeError) return new CallError('connection');
  return new CallError('unknown');
}

// Пропуск в комнату выдаёт NestJS: он один знает, активна ли
// консультация и подтверждён ли hold. Медиапоток идёт мимо Next и Nest —
// напрямую в LiveKit.
async function requestGrant(
  consultationId: string,
  format: 'audio' | 'video',
  signal?: AbortSignal,
): Promise<Grant> {
  let response: Response;
  try {
    response = await sessionFetch(
      `/api/proxy/consultations/${consultationId}/media-token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
        signal,
      },
    );
  } catch (caught) {
    throw classifyCallError(caught);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      error?: { code?: string };
    } | null;
    const code = payload?.error?.code ?? payload?.code;
    if (code === 'CONSULTATION_NOT_ACTIVE') throw new CallError('not-active');
    if (code === 'PAYMENT_HOLD_REQUIRED') {
      throw new CallError('payment-required');
    }
    throw new CallError('connection');
  }

  return (await response.json()) as Grant;
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const cancelled = new Error('Call join cancelled');
  cancelled.name = 'AbortError';
  throw cancelled;
}

export async function joinCall(
  consultationId: string,
  format: 'audio' | 'video',
  devices: Chosen,
  signal?: AbortSignal,
): Promise<Call> {
  const grant = await requestGrant(consultationId, format, signal);
  // Некоторые fetch-моки и старые реализации не отклоняют promise по abort.
  // До создания Room повторно проверяем владение попыткой подключения.
  throwIfAborted(signal);
  const room = new Room();
  const remoteTracks = new Set<RemoteTrack>();
  const stateHandlers = new Set<(state: CallState) => void>();
  let mediaTargets: RemoteMediaTargets | null = null;
  let state: CallState = 'connected';
  let leavePromise: Promise<void> | null = null;
  let cleanupPromise: Promise<void> | null = null;

  function targetFor(track: RemoteTrack): HTMLMediaElement | null {
    if (!mediaTargets) return null;
    if (track.kind === Track.Kind.Audio) return mediaTargets.audio;
    if (track.kind === Track.Kind.Video) return mediaTargets.video ?? null;
    return null;
  }

  function attachTrack(track: RemoteTrack) {
    remoteTracks.add(track);
    const target = targetFor(track);
    if (target) track.attach(target);
  }

  function detachTrack(track: RemoteTrack) {
    const target = targetFor(track);
    if (target) track.detach(target);
    remoteTracks.delete(track);
  }

  function detachAllRemoteTracks() {
    for (const track of remoteTracks) {
      const target = targetFor(track);
      if (target) track.detach(target);
    }
    remoteTracks.clear();
  }

  function emitState(next: CallState) {
    state = next;
    stateHandlers.forEach((handler) => handler(next));
  }

  const onTrackSubscribed = (track: RemoteTrack) => attachTrack(track);
  const onTrackUnsubscribed = (track: RemoteTrack) => detachTrack(track);
  const onParticipantDisconnected = (participant: RemoteParticipant) => {
    participant.trackPublications.forEach((publication) => {
      if (publication.track) detachTrack(publication.track);
    });
  };
  const onReconnecting = () => emitState('reconnecting');
  const onReconnected = () => emitState('connected');
  const onDisconnected = () => {
    detachAllRemoteTracks();
    removeRoomListeners();
    emitState('disconnected');
  };

  function addRoomListeners() {
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
  }

  function removeRoomListeners() {
    room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.off(RoomEvent.Reconnecting, onReconnecting);
    room.off(RoomEvent.Reconnected, onReconnected);
    room.off(RoomEvent.Disconnected, onDisconnected);
  }

  async function stopLocalTracks() {
    await Promise.allSettled([
      room.localParticipant.setMicrophoneEnabled(false),
      room.localParticipant.setCameraEnabled(false),
    ]);
  }

  function cleanupRoom(emitDisconnected: boolean): Promise<void> {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      removeRoomListeners();
      detachAllRemoteTracks();
      // disconnect вызывается одновременно с выключением устройств: cleanup
      // не должен ждать зависшего запроса камеры, чтобы освободить room.
      await Promise.allSettled([stopLocalTracks(), room.disconnect()]);
      if (emitDisconnected) emitState('disconnected');
    })();
    return cleanupPromise;
  }

  const onJoinAborted = () => {
    void cleanupRoom(false);
  };

  addRoomListeners();
  signal?.addEventListener('abort', onJoinAborted, { once: true });

  try {
    throwIfAborted(signal);
    await room.connect(grant.url, grant.token);
    throwIfAborted(signal);

    // TrackSubscribed не обязан сработать для публикаций, которые уже были
    // подписаны к моменту, когда UI получил Call. Явно забираем snapshot.
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (publication.track) attachTrack(publication.track);
      });
    });

    await room.localParticipant.setMicrophoneEnabled(
      true,
      devices.microphoneId ? { deviceId: devices.microphoneId } : undefined,
    );
    throwIfAborted(signal);
    // В аудиоформате камера не включается вовсе.
    if (format === 'video') {
      await room.localParticipant.setCameraEnabled(
        true,
        devices.cameraId ? { deviceId: devices.cameraId } : undefined,
      );
      throwIfAborted(signal);
    }
  } catch (caught) {
    signal?.removeEventListener('abort', onJoinAborted);
    await cleanupRoom(false);
    throw classifyCallError(caught);
  }
  signal?.removeEventListener('abort', onJoinAborted);

  return {
    room,
    bindRemoteMedia: (targets) => {
      if (mediaTargets) {
        for (const track of remoteTracks) {
          const previousTarget = targetFor(track);
          if (previousTarget) track.detach(previousTarget);
        }
      }

      mediaTargets = targets;
      remoteTracks.forEach((track) => {
        const target = targetFor(track);
        if (target) track.attach(target);
      });

      return () => {
        if (mediaTargets !== targets) return;
        for (const track of remoteTracks) {
          const target = targetFor(track);
          if (target) track.detach(target);
        }
        mediaTargets = null;
      };
    },
    leave: () => {
      if (leavePromise) return leavePromise;
      leavePromise = cleanupRoom(true);
      return leavePromise;
    },
    onStateChange: (handler) => {
      stateHandlers.add(handler);
      handler(state);
      return () => stateHandlers.delete(handler);
    },
    onDisconnected: (handler) => {
      const stateHandler = (next: CallState) => {
        if (next === 'disconnected') handler();
      };
      stateHandlers.add(stateHandler);
      return () => stateHandlers.delete(stateHandler);
    },
  };
}
