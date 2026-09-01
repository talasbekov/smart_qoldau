import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const listDevices = jest.fn();
jest.mock('@/lib/realtime/devices', () => ({
  listDevices: () => listDevices(),
  DeviceError: class DeviceError extends Error {
    constructor(public reason: string) {
      super(reason);
    }
  },
}));

// eslint-disable-next-line import/first
import DeviceCheck from './DeviceCheck';
// eslint-disable-next-line import/first
import { DeviceError } from '@/lib/realtime/devices';

const DEVICES = {
  cameras: [
    { id: 'cam1', label: 'Встроенная камера' },
    { id: 'cam2', label: 'Внешняя камера' },
  ],
  microphones: [{ id: 'mic1', label: 'Микрофон гарнитуры' }],
};

afterEach(() => jest.clearAllMocks());

describe('DeviceCheck', () => {
  it('даёт выбрать камеру и микрофон ДО входа в комнату', async () => {
    listDevices.mockResolvedValue(DEVICES);
    render(<DeviceCheck format="video" onJoin={jest.fn()} />);

    expect(await screen.findByLabelText('Камера')).toBeInTheDocument();
    expect(screen.getByLabelText('Микрофон')).toBeInTheDocument();
  });

  it('в аудиоформате камеру не спрашивает', async () => {
    listDevices.mockResolvedValue(DEVICES);
    render(<DeviceCheck format="audio" onJoin={jest.fn()} />);

    await screen.findByLabelText('Микрофон');
    expect(screen.queryByLabelText('Камера')).toBeNull();
  });

  it('передаёт выбранные устройства при входе', async () => {
    listDevices.mockResolvedValue(DEVICES);
    const onJoin = jest.fn();
    render(<DeviceCheck format="video" onJoin={onJoin} />);

    fireEvent.change(await screen.findByLabelText('Камера'), { target: { value: 'cam2' } });
    fireEvent.click(screen.getByRole('button', { name: /Подключиться/ }));

    expect(onJoin).toHaveBeenCalledWith({ cameraId: 'cam2', microphoneId: 'mic1' });
  });

  it('отказ в доступе объясняет словами и предлагает чат', async () => {
    listDevices.mockRejectedValue(new DeviceError('denied'));
    render(<DeviceCheck format="video" onJoin={jest.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/доступ/i);
    expect(screen.getByText(/можно продолжить в чате/i)).toBeInTheDocument();
  });

  it('отсутствие камеры не выдаётся за отказ', async () => {
    listDevices.mockRejectedValue(new DeviceError('missing'));
    render(<DeviceCheck format="video" onJoin={jest.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/не наш(ли|лось)|нет камеры|устройств/i);
  });

  it('пока устройства опрашиваются, вход заблокирован', async () => {
    listDevices.mockReturnValue(new Promise(() => {}));
    render(<DeviceCheck format="video" onJoin={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Подключиться/ })).toBeDisabled(),
    );
  });
});
