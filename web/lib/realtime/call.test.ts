import { CallError, joinCall } from './call';
import { waitFor } from '@testing-library/react';

type Handler = (...args: any[]) => void;

const handlers = new Map<string, Set<Handler>>();
const room = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  remoteParticipants: new Map(),
  localParticipant: {
    setCameraEnabled: jest.fn().mockResolvedValue(undefined),
    setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
  },
  on: jest.fn((event: string, handler: Handler) => {
    const registered = handlers.get(event) ?? new Set<Handler>();
    registered.add(handler);
    handlers.set(event, registered);
  }),
  off: jest.fn((event: string, handler: Handler) => {
    handlers.get(event)?.delete(handler);
  }),
};

jest.mock('livekit-client', () => ({
  Room: jest.fn(() => room),
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    ParticipantDisconnected: 'participantDisconnected',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    Disconnected: 'disconnected',
  },
  Track: { Kind: { Audio: 'audio', Video: 'video' } },
}));

const originalFetch = global.fetch;

beforeEach(() => {
  handlers.clear();
  room.remoteParticipants.clear();
  room.connect.mockResolvedValue(undefined);
  room.disconnect.mockResolvedValue(undefined);
  room.localParticipant.setCameraEnabled.mockResolvedValue(undefined);
  room.localParticipant.setMicrophoneEnabled.mockResolvedValue(undefined);
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

function tokenResponds(status: number, payload: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }) as unknown as typeof fetch;
}

function remoteTrack(kind: 'audio' | 'video') {
  return {
    kind,
    attach: jest.fn((element: HTMLMediaElement) => element),
    detach: jest.fn(),
  };
}

function emit(event: string, ...args: unknown[]) {
  handlers.get(event)?.forEach((handler) => handler(...args));
}

const GRANT = { token: 'lk-token', url: 'wss://livekit.example', room: 'c1' };

describe('joinCall', () => {
  it('берёт пропуск в комнату у бэкенда через прокси', async () => {
    tokenResponds(200, GRANT);

    await joinCall('c1', 'video', { cameraId: null, microphoneId: null });

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      '/api/proxy/consultations/c1/media-token',
    );
  });

  it('подключается по адресу и токену, которые выдал бэкенд', async () => {
    tokenResponds(200, GRANT);

    await joinCall('c1', 'video', { cameraId: null, microphoneId: null });

    expect(room.connect).toHaveBeenCalledWith('wss://livekit.example', 'lk-token');
  });

  it('прикрепляет уже подписанные remote audio/video после позднего bind UI', async () => {
    tokenResponds(200, GRANT);
    const audioTrack = remoteTrack('audio');
    const videoTrack = remoteTrack('video');
    room.remoteParticipants.set('other', {
      trackPublications: new Map([
        ['a', { track: audioTrack }],
        ['v', { track: videoTrack }],
      ]),
    });

    const call = await joinCall('c1', 'video', { cameraId: null, microphoneId: null });
    const audio = document.createElement('audio');
    const video = document.createElement('video');
    call.bindRemoteMedia({ audio, video });

    expect(audioTrack.attach).toHaveBeenCalledWith(audio);
    expect(videoTrack.attach).toHaveBeenCalledWith(video);
  });

  it('прикрепляет новые remote tracks и отсоединяет их при unsubscribe', async () => {
    tokenResponds(200, GRANT);
    const call = await joinCall('c1', 'video', { cameraId: null, microphoneId: null });
    const audio = document.createElement('audio');
    const video = document.createElement('video');
    call.bindRemoteMedia({ audio, video });
    const track = remoteTrack('video');

    emit('trackSubscribed', track, {}, {});
    expect(track.attach).toHaveBeenCalledWith(video);

    emit('trackUnsubscribed', track, {}, {});
    expect(track.detach).toHaveBeenCalledWith(video);
  });

  it('отсоединяет tracks ушедшего участника даже без TrackUnsubscribed', async () => {
    tokenResponds(200, GRANT);
    const call = await joinCall('c1', 'audio', { cameraId: null, microphoneId: null });
    const audio = document.createElement('audio');
    call.bindRemoteMedia({ audio, video: null });
    const track = remoteTrack('audio');
    const participant = {
      trackPublications: new Map([['a', { track }]]),
    };
    emit('trackSubscribed', track, {}, participant);

    emit('participantDisconnected', participant);

    expect(track.detach).toHaveBeenCalledWith(audio);
  });

  it('сообщает reconnect/reconnected/disconnected и позволяет снять подписку', async () => {
    tokenResponds(200, GRANT);
    const call = await joinCall('c1', 'audio', { cameraId: null, microphoneId: null });
    const listener = jest.fn();
    const unsubscribe = call.onStateChange(listener);

    emit('reconnecting');
    emit('reconnected');
    unsubscribe();
    emit('reconnecting');

    expect(listener.mock.calls.map(([state]) => state)).toEqual([
      'connected',
      'reconnecting',
      'connected',
    ]);
  });

  it('в аудиоформате камеру не включает вовсе', async () => {
    tokenResponds(200, GRANT);

    await joinCall('c1', 'audio', { cameraId: 'cam1', microphoneId: 'mic1' });

    expect(room.localParticipant.setCameraEnabled).not.toHaveBeenCalledWith(true);
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true, {
      deviceId: 'mic1',
    });
  });

  it('при ошибке камеры останавливает микрофон, снимает listeners и отключается', async () => {
    tokenResponds(200, GRANT);
    room.localParticipant.setCameraEnabled.mockRejectedValueOnce(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    );

    await expect(
      joinCall('c1', 'video', { cameraId: 'cam1', microphoneId: 'mic1' }),
    ).rejects.toMatchObject<Partial<CallError>>({ reason: 'permission-denied' });

    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
    expect(room.disconnect).toHaveBeenCalled();
    expect(room.off).toHaveBeenCalled();
  });

  it('leave идемпотентно останавливает local tracks, remote media и listeners', async () => {
    tokenResponds(200, GRANT);
    const call = await joinCall('c1', 'video', { cameraId: null, microphoneId: null });
    const track = remoteTrack('audio');
    const audio = document.createElement('audio');
    call.bindRemoteMedia({ audio, video: document.createElement('video') });
    emit('trackSubscribed', track, {}, {});

    await Promise.all([call.leave(), call.leave()]);

    expect(track.detach).toHaveBeenCalledWith(audio);
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    expect(room.localParticipant.setCameraEnabled).toHaveBeenCalledWith(false);
    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(room.off).toHaveBeenCalled();
  });

  it('без пропуска не создаёт комнату и возвращает типизированную причину', async () => {
    tokenResponds(403, { code: 'CONSULTATION_NOT_ACTIVE' });

    await expect(
      joinCall('c1', 'video', { cameraId: null, microphoneId: null }),
    ).rejects.toMatchObject<Partial<CallError>>({ reason: 'not-active' });
    expect(room.connect).not.toHaveBeenCalled();
  });

  it('отмена до позднего grant не создаёт комнату и не включает микрофон', async () => {
    let resolveGrant!: (value: unknown) => void;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveGrant = resolve;
        }),
    ) as unknown as typeof fetch;
    const controller = new AbortController();
    const joining = (joinCall as typeof joinCall)(
      'c1',
      'audio',
      { cameraId: null, microphoneId: null },
      controller.signal,
    );

    controller.abort();
    resolveGrant({ ok: true, json: async () => GRANT });

    await expect(joining).rejects.toBeDefined();
    expect(room.connect).not.toHaveBeenCalled();
    expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalledWith(
      true,
      undefined,
    );
  });

  it('отмена во время запуска камеры сразу гасит опубликованный микрофон и room', async () => {
    tokenResponds(200, GRANT);
    let resolveCamera!: () => void;
    room.localParticipant.setCameraEnabled.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCamera = resolve;
        }),
    );
    const controller = new AbortController();
    const joining = (joinCall as typeof joinCall)(
      'c1',
      'video',
      { cameraId: null, microphoneId: null },
      controller.signal,
    );
    await waitFor(() =>
      expect(room.localParticipant.setCameraEnabled).toHaveBeenCalledWith(
        true,
        undefined,
      ),
    );

    controller.abort();
    try {
      await waitFor(() => expect(room.disconnect).toHaveBeenCalled(), {
        timeout: 150,
      });
      expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    } finally {
      resolveCamera();
      await joining.catch(() => undefined);
    }
  });
});
