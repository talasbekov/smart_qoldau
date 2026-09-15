import { listDevices, DeviceError } from './devices';

const originalMedia = global.navigator?.mediaDevices;
afterEach(() => {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: originalMedia,
    configurable: true,
  });
});

function mockMedia(impl: Partial<MediaDevices>) {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: impl,
    configurable: true,
  });
}

const DEVICES = [
  { kind: 'videoinput', deviceId: 'cam1', label: 'Встроенная камера' },
  { kind: 'audioinput', deviceId: 'mic1', label: 'Микрофон гарнитуры' },
  { kind: 'audiooutput', deviceId: 'spk1', label: 'Динамики' },
] as MediaDeviceInfo[];

describe('listDevices', () => {
  it('разделяет камеры и микрофоны, выбрасывая динамики', async () => {
    mockMedia({
      getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [] }),
      enumerateDevices: jest.fn().mockResolvedValue(DEVICES),
    });

    await expect(listDevices()).resolves.toEqual({
      cameras: [{ id: 'cam1', label: 'Встроенная камера' }],
      microphones: [{ id: 'mic1', label: 'Микрофон гарнитуры' }],
    });
  });

  it('сначала просит доступ: без него у устройств пустые названия', async () => {
    const getUserMedia = jest.fn().mockResolvedValue({ getTracks: () => [] });
    mockMedia({ getUserMedia, enumerateDevices: jest.fn().mockResolvedValue(DEVICES) });

    await listDevices();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
  });

  it('в аудиоформате не требует камеру и не включает её для проверки', async () => {
    const getUserMedia = jest.fn().mockResolvedValue({ getTracks: () => [] });
    mockMedia({
      getUserMedia,
      enumerateDevices: jest
        .fn()
        .mockResolvedValue(DEVICES.filter((device) => device.kind !== 'videoinput')),
    });

    await expect(listDevices('audio')).resolves.toEqual({
      cameras: [],
      microphones: [{ id: 'mic1', label: 'Микрофон гарнитуры' }],
    });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  });

  it('гасит пробную дорожку: иначе камера горит до конца сессии', async () => {
    const stop = jest.fn();
    mockMedia({
      getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop }] }),
      enumerateDevices: jest.fn().mockResolvedValue(DEVICES),
    });

    await listDevices();

    expect(stop).toHaveBeenCalled();
  });

  it('отказ в доступе отличает от поломки: это разные советы человеку', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    mockMedia({ getUserMedia: jest.fn().mockRejectedValue(denied), enumerateDevices: jest.fn() });

    await expect(listDevices()).rejects.toMatchObject({ reason: 'denied' });
  });

  it('отсутствие камеры — не отказ, а отсутствие камеры', async () => {
    const missing = Object.assign(new Error('no device'), { name: 'NotFoundError' });
    mockMedia({ getUserMedia: jest.fn().mockRejectedValue(missing), enumerateDevices: jest.fn() });

    await expect(listDevices()).rejects.toMatchObject({ reason: 'missing' });
  });

  it('браузер без поддержки говорит об этом прямо', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });

    await expect(listDevices()).rejects.toBeInstanceOf(DeviceError);
  });
});
