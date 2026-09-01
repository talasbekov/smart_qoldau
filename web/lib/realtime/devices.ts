export type Device = { id: string; label: string };
export type Devices = { cameras: Device[]; microphones: Device[] };

export type DeviceFailure = 'denied' | 'missing' | 'unsupported' | 'unknown';

export class DeviceError extends Error {
  constructor(readonly reason: DeviceFailure) {
    super(`Не удалось получить список устройств: ${reason}`);
    this.name = 'DeviceError';
  }
}

function toDevice(info: MediaDeviceInfo, index: number): Device {
  return {
    id: info.deviceId,
    // Пустое название бывает у второй и последующих камер до выдачи
    // доступа; показывать пустую строку в списке нельзя.
    label: info.label || `Устройство ${index + 1}`,
  };
}

export async function listDevices(): Promise<Devices> {
  const media = navigator.mediaDevices;
  if (!media?.enumerateDevices) throw new DeviceError('unsupported');

  try {
    // Без выданного доступа браузер отдаёт устройства без названий —
    // выбрать из «Устройство 1» и «Устройство 2» человек не сможет.
    const probe = await media.getUserMedia({ audio: true, video: true });
    // Пробную дорожку обязательно гасим: иначе индикатор камеры горит
    // ещё до входа в комнату, и это выглядит как слежка.
    for (const track of probe.getTracks()) track.stop();
  } catch (caught) {
    const name = (caught as { name?: string }).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new DeviceError('denied');
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') throw new DeviceError('missing');
    throw new DeviceError('unknown');
  }

  const all = await media.enumerateDevices();
  return {
    cameras: all.filter((d) => d.kind === 'videoinput').map(toDevice),
    microphones: all.filter((d) => d.kind === 'audioinput').map(toDevice),
  };
}
