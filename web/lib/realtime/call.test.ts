import { joinCall } from './call';

const room = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  localParticipant: {
    setCameraEnabled: jest.fn().mockResolvedValue(undefined),
    setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
  },
  on: jest.fn(),
};

jest.mock('livekit-client', () => ({
  Room: jest.fn(() => room),
  RoomEvent: { Disconnected: 'disconnected', ConnectionStateChanged: 'stateChanged' },
}));

const originalFetch = global.fetch;
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

  it('в аудиоформате камеру не включает вовсе', async () => {
    tokenResponds(200, GRANT);

    await joinCall('c1', 'audio', { cameraId: 'cam1', microphoneId: 'mic1' });

    expect(room.localParticipant.setCameraEnabled).not.toHaveBeenCalledWith(true);
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true, {
      deviceId: 'mic1',
    });
  });

  it('в видеоформате включает и камеру, и микрофон выбранными устройствами', async () => {
    tokenResponds(200, GRANT);

    await joinCall('c1', 'video', { cameraId: 'cam2', microphoneId: 'mic1' });

    expect(room.localParticipant.setCameraEnabled).toHaveBeenCalledWith(true, {
      deviceId: 'cam2',
    });
  });

  it('без пропуска не создаёт комнату и говорит понятную ошибку', async () => {
    tokenResponds(403, { code: 'CONSULTATION_NOT_ACTIVE' });

    await expect(joinCall('c1', 'video', { cameraId: null, microphoneId: null })).rejects.toThrow(
      /не удалось|не активна/i,
    );
    expect(room.connect).not.toHaveBeenCalled();
  });
});
