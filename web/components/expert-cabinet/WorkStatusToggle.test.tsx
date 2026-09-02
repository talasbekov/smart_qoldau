import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const apiFetch = jest.fn().mockResolvedValue(null);
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
}));

// eslint-disable-next-line import/first
import WorkStatusToggle from './WorkStatusToggle';

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    value: hidden ? 'hidden' : 'visible',
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('WorkStatusToggle', () => {
  it('включение сообщает бэкенду, что эксперт принимает', async () => {
    render(<WorkStatusToggle initial="NOT_ACCEPTING" />);

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        'experts/me/work-status',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
  });

  it('состояние выражено через aria-checked, а не только цветом', () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('пока вкладка открыта, шлёт heartbeat', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);
    apiFetch.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    expect(apiFetch).toHaveBeenCalledWith('experts/me/heartbeat', expect.objectContaining({ method: 'POST' }));
  });

  it('скрытая вкладка перестаёт слать heartbeat: иначе онлайн — обман', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);
    setHidden(true);
    apiFetch.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    // В приложении статус держит фоновая служба, в браузере её нет.
    // «Принимаю клиентов» у закрытой вкладки — офферы в пустоту.
    expect(apiFetch).not.toHaveBeenCalledWith('experts/me/heartbeat', expect.anything());
  });

  it('возврат на вкладку возобновляет heartbeat', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);
    setHidden(true);
    setHidden(false);
    apiFetch.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    expect(apiFetch).toHaveBeenCalledWith('experts/me/heartbeat', expect.anything());
  });

  it('выключение прекращает heartbeat', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'));
    apiFetch.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(apiFetch).not.toHaveBeenCalledWith('experts/me/heartbeat', expect.anything());
  });

  it('объясняет, почему онлайн держится только на открытой вкладке', () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);

    expect(screen.getByText(/вкладк/i)).toBeInTheDocument();
  });
});
