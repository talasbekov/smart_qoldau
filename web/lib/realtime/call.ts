import { Room, RoomEvent } from 'livekit-client';
import type { Chosen } from '@/components/client/DeviceCheck';

export type Call = {
  room: Room;
  leave: () => Promise<void>;
  onDisconnected: (handler: () => void) => void;
};

type Grant = { token: string; url: string; room: string };

// Пропуск в комнату выдаёт NestJS: он один знает, активна ли
// консультация и оплачена ли она. Медиапоток идёт мимо и Next, и Nest —
// напрямую в LiveKit.
async function requestGrant(consultationId: string, format: 'audio' | 'video'): Promise<Grant> {
  const response = await fetch(`/api/proxy/consultations/${consultationId}/media-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format }),
  });

  if (!response.ok) {
    const code = ((await response.json().catch(() => null)) as { code?: string } | null)?.code;
    throw new Error(
      code === 'CONSULTATION_NOT_ACTIVE'
        ? 'Консультация не активна — подключиться нельзя'
        : 'Не удалось подключиться к звонку',
    );
  }

  return (await response.json()) as Grant;
}

export async function joinCall(
  consultationId: string,
  format: 'audio' | 'video',
  devices: Chosen,
): Promise<Call> {
  const grant = await requestGrant(consultationId, format);

  const room = new Room();
  await room.connect(grant.url, grant.token);

  await room.localParticipant.setMicrophoneEnabled(
    true,
    devices.microphoneId ? { deviceId: devices.microphoneId } : undefined,
  );
  // В аудиоформате камера не включается вовсе: человек выбрал разговор
  // без видео, и включать её «на всякий случай» — нарушение этого выбора.
  if (format === 'video') {
    await room.localParticipant.setCameraEnabled(
      true,
      devices.cameraId ? { deviceId: devices.cameraId } : undefined,
    );
  }

  return {
    room,
    leave: () => room.disconnect(),
    onDisconnected: (handler) => {
      room.on(RoomEvent.Disconnected, handler);
    },
  };
}
