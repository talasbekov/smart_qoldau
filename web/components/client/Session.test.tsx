import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

let stateHandler: ((state: 'connected' | 'reconnecting' | 'disconnected') => void) | null =
  null;
const unbindRemoteMedia = jest.fn();
const unsubscribeState = jest.fn();
const call = {
  room: {
    localParticipant: {
      setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
      setCameraEnabled: jest.fn().mockResolvedValue(undefined),
    },
  },
  leave: jest.fn().mockResolvedValue(undefined),
  bindRemoteMedia: jest.fn(
    (_targets: { audio: HTMLAudioElement; video?: HTMLVideoElement | null }) =>
      unbindRemoteMedia,
  ),
  onStateChange: jest.fn(
    (handler: (state: 'connected' | 'reconnecting' | 'disconnected') => void) => {
      stateHandler = handler;
      handler('connected');
      return unsubscribeState;
    },
  ),
  onDisconnected: jest.fn(),
};
const joinCall = jest.fn().mockResolvedValue(call);
jest.mock('@/lib/realtime/call', () => ({
  joinCall: (...args: unknown[]) => joinCall(...args),
  CallError: class CallError extends Error {
    constructor(public reason: string) {
      super(reason);
    }
  },
}));
jest.mock('./Chat', () => ({
  __esModule: true,
  default: () => <div data-testid="chat">чат</div>,
}));
jest.mock('./DeviceCheck', () => ({
  __esModule: true,
  default: ({ onJoin }: { onJoin: (chosen: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onJoin({ cameraId: 'cam1', microphoneId: 'mic1' })}
    >
      Подключиться
    </button>
  ),
}));

// eslint-disable-next-line import/first
import Session from './Session';
// eslint-disable-next-line import/first
import { CallError } from '@/lib/realtime/call';

beforeEach(() => {
  stateHandler = null;
  joinCall.mockResolvedValue(call);
  call.room.localParticipant.setMicrophoneEnabled.mockResolvedValue(undefined);
  call.room.localParticipant.setCameraEnabled.mockResolvedValue(undefined);
});

afterEach(() => jest.clearAllMocks());

async function join() {
  fireEvent.click(screen.getByRole('button', { name: 'Подключиться' }));
  await waitFor(() => expect(joinCall).toHaveBeenCalled());
  await waitFor(() => expect(call.onStateChange).toHaveBeenCalled());
}

describe('Session', () => {
  it('до подключения показывает проверку устройств, а не пустой экран', () => {
    render(<Session consultationId="c1" format="video" locale="ru" />);

    expect(screen.getByRole('button', { name: 'Подключиться' })).toBeInTheDocument();
  });

  it('после входа привязывает remote audio/video к реальным media elements', async () => {
    render(<Session consultationId="c1" format="video" locale="ru" />);
    await join();

    await waitFor(() => expect(call.bindRemoteMedia).toHaveBeenCalled());
    const targets = call.bindRemoteMedia.mock.calls[0][0];
    expect(targets.audio).toBeInstanceOf(HTMLAudioElement);
    expect(targets.video).toBeInstanceOf(HTMLVideoElement);
    expect(screen.getByLabelText('Видео собеседника')).toBeInTheDocument();
  });

  it('чат доступен рядом со звонком, а не вместо него', async () => {
    render(<Session consultationId="c1" format="video" locale="ru" />);
    await join();

    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });

  it('выключение микрофона меняет состояние только после подтверждения SDK', async () => {
    let resolveToggle!: () => void;
    call.room.localParticipant.setMicrophoneEnabled.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveToggle = resolve;
      }),
    );
    render(<Session consultationId="c1" format="video" locale="ru" />);
    await join();

    const button = screen.getByRole('button', { name: /микрофон/i });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    resolveToggle();

    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
  });

  it('ошибка переключения устройства остаётся видимой и не врёт о состоянии', async () => {
    call.room.localParticipant.setMicrophoneEnabled.mockRejectedValueOnce(new Error('lost'));
    render(<Session consultationId="c1" format="video" locale="ru" />);
    await join();

    const button = screen.getByRole('button', { name: /микрофон/i });
    fireEvent.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(/микрофон/i);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('в аудиоформате не создаёт video target и не показывает кнопку камеры', async () => {
    render(<Session consultationId="c1" format="audio" locale="ru" />);
    await join();

    await waitFor(() => expect(call.bindRemoteMedia).toHaveBeenCalled());
    expect(call.bindRemoteMedia.mock.calls[0][0].video).toBeNull();
    expect(screen.queryByRole('button', { name: /камер/i })).toBeNull();
    expect(screen.getByText('Аудиозвонок подключён')).toBeInTheDocument();
  });

  it('уход из звонка не называется завершением консультации', async () => {
    render(<Session consultationId="c1" format="video" locale="ru" />);
    await join();

    expect(screen.queryByRole('button', { name: /завершить консультацию/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Выйти из звонка' }));

    await waitFor(() => expect(call.leave).toHaveBeenCalled());
  });

  it('показывает реконнект и возвращается в connected без размонтирования звонка', async () => {
    render(<Session consultationId="c1" format="video" locale="ru" />);
    await join();

    act(() => stateHandler?.('reconnecting'));
    expect(await screen.findByRole('status')).toHaveTextContent(/восстанавливаем связь/i);

    act(() => stateHandler?.('connected'));
    await waitFor(() =>
      expect(screen.queryByText(/восстанавливаем связь/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Видео собеседника')).toBeInTheDocument();
  });

  it('необратимый disconnect объясняет и возвращает возможность подключиться', async () => {
    render(<Session consultationId="c1" format="video" locale="ru" />);
    await join();

    act(() => stateHandler?.('disconnected'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/соединение прервано/i);
    expect(screen.getByRole('button', { name: 'Подключиться' })).toBeInTheDocument();
  });

  it('ошибку разрешения объясняет и оставляет чат', async () => {
    joinCall.mockRejectedValueOnce(new CallError('permission-denied'));
    render(<Session consultationId="c1" format="video" locale="ru" />);
    fireEvent.click(screen.getByRole('button', { name: 'Подключиться' }));
    await waitFor(() => expect(joinCall).toHaveBeenCalled());

    expect(await screen.findByRole('alert')).toHaveTextContent(/доступ/i);
    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });

  it('локализует изменённый call UI на казахский', async () => {
    render(<Session consultationId="c1" format="audio" locale="kz" />);
    await join();

    expect(screen.getByRole('button', { name: 'Қоңыраудан шығу' })).toBeInTheDocument();
    expect(screen.getByText('Аудиоқоңырау қосылды')).toBeInTheDocument();
  });

  it('unmount снимает media/state subscriptions и останавливает звонок', async () => {
    const { unmount } = render(
      <Session consultationId="c1" format="video" locale="ru" />,
    );
    await join();

    unmount();

    expect(unbindRemoteMedia).toHaveBeenCalled();
    expect(unsubscribeState).toHaveBeenCalled();
    expect(call.leave).toHaveBeenCalled();
  });
});
