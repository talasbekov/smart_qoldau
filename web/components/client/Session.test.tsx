import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const call = {
  room: {
    localParticipant: {
      setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
      setCameraEnabled: jest.fn().mockResolvedValue(undefined),
    },
  },
  leave: jest.fn().mockResolvedValue(undefined),
  onDisconnected: jest.fn(),
};
const joinCall = jest.fn().mockResolvedValue(call);
jest.mock('@/lib/realtime/call', () => ({ joinCall: (...a: unknown[]) => joinCall(...a) }));
jest.mock('./Chat', () => ({
  __esModule: true,
  default: () => <div data-testid="chat">чат</div>,
}));
jest.mock('./DeviceCheck', () => ({
  __esModule: true,
  default: ({ onJoin }: { onJoin: (c: unknown) => void }) => (
    <button type="button" onClick={() => onJoin({ cameraId: 'cam1', microphoneId: 'mic1' })}>
      Подключиться
    </button>
  ),
}));

// eslint-disable-next-line import/first
import Session from './Session';

afterEach(() => jest.clearAllMocks());

async function join() {
  fireEvent.click(screen.getByRole('button', { name: 'Подключиться' }));
  await waitFor(() => expect(joinCall).toHaveBeenCalled());
}

describe('Session', () => {
  it('до подключения показывает проверку устройств, а не пустой экран', () => {
    render(<Session consultationId="c1" format="video" />);

    expect(screen.getByRole('button', { name: 'Подключиться' })).toBeInTheDocument();
  });

  it('чат доступен рядом со звонком, а не вместо него', async () => {
    render(<Session consultationId="c1" format="video" />);
    await join();

    // Уходить с экрана видео, чтобы прочитать сообщение, одинаково плохо
    // обеим сторонам разговора.
    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });

  it('кнопки управления называются словами и сообщают состояние', async () => {
    render(<Session consultationId="c1" format="video" />);
    await join();

    expect(screen.getByRole('button', { name: /микрофон/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('выключение микрофона меняет состояние кнопки и говорит комнате', async () => {
    render(<Session consultationId="c1" format="video" />);
    await join();

    fireEvent.click(screen.getByRole('button', { name: /микрофон/i }));

    await waitFor(() =>
      expect(call.room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false),
    );
    expect(screen.getByRole('button', { name: /микрофон/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('в аудиоформате кнопки камеры нет', async () => {
    render(<Session consultationId="c1" format="audio" />);
    await join();

    expect(screen.queryByRole('button', { name: /камер/i })).toBeNull();
  });

  it('завершение выходит из комнаты', async () => {
    render(<Session consultationId="c1" format="video" />);
    await join();

    fireEvent.click(screen.getByRole('button', { name: /Завершить/ }));

    await waitFor(() => expect(call.leave).toHaveBeenCalled());
  });

  it('ошибку подключения объясняет и оставляет чат', async () => {
    joinCall.mockRejectedValueOnce(new Error('Консультация не активна — подключиться нельзя'));
    render(<Session consultationId="c1" format="video" />);
    await join();

    expect(await screen.findByRole('alert')).toHaveTextContent(/не активна/i);
    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });
});
