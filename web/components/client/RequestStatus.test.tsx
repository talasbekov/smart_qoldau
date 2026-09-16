import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// Сокет подменяется целиком: тест проверяет реакцию экрана на событие,
// а не транспорт — у него свои тесты.
const handlers: Record<string, (payload: unknown) => void> = {};
const close = jest.fn();
const connectRealtime = jest.fn();
jest.mock('@/lib/realtime/socket', () => ({
  connectRealtime: (...args: unknown[]) => connectRealtime(...args),
}));

const apiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

// eslint-disable-next-line import/first
import RequestStatus from './RequestStatus';

function connectedSocket() {
  return {
    on: (event: string, handler: (payload: unknown) => void) => {
      handlers[event] = handler;
      return () => delete handlers[event];
    },
    onReady: (handler: (payload: unknown) => void) => {
      handlers.ready = handler;
      return () => delete handlers.ready;
    },
    send: () => {},
    close,
  };
}

beforeEach(() => {
  connectRealtime.mockReset();
  apiFetch.mockReset();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  for (const key of Object.keys(handlers)) delete handlers[key];
});

describe('RequestStatus', () => {
  it('пока идёт подбор, говорит об этом, а не показывает пустоту', async () => {
    connectRealtime.mockResolvedValue(connectedSocket());
    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );

    expect(
      screen.getByText(/Ищем свободного специалиста/i),
    ).toBeInTheDocument();
  });

  it('когда специалист найден, ведёт к консультации по событию сокета', async () => {
    connectRealtime.mockResolvedValue(connectedSocket());
    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );
    await waitFor(() => expect(handlers['request.updated']).toBeDefined());

    await act(async () => {
      handlers['request.updated']({
        id: 'r1',
        status: 'MATCHED',
        consultationId: 'c1',
      });
    });

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/ru/consultations/c1'),
    );
  });

  it('не реагирует на событие о чужой заявке', async () => {
    connectRealtime.mockResolvedValue(connectedSocket());
    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );
    await waitFor(() => expect(handlers['request.updated']).toBeDefined());

    await act(async () => {
      handlers['request.updated']({
        id: 'other',
        status: 'MATCHED',
        consultationId: 'c9',
      });
    });

    expect(push).not.toHaveBeenCalled();
  });

  it('закрывает сокет, когда экран уходит', async () => {
    connectRealtime.mockResolvedValue(connectedSocket());
    const { unmount } = render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );
    await waitFor(() => expect(handlers['request.updated']).toBeDefined());

    unmount();
    await waitFor(() => expect(close).toHaveBeenCalled());
  });

  it('когда свободных нет, объясняет и предлагает экстренные службы', async () => {
    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'NO_EXPERTS', hotlines: ['150', '112'] }}
        locale="ru"
      />,
    );

    expect(screen.getByText(/сейчас никого/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /150/ })).toHaveAttribute(
      'href',
      'tel:150',
    );
  });

  it('отменённая заявка не изображает поиск', () => {
    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'CANCELLED' }}
        locale="ru"
      />,
    );

    expect(screen.queryByText(/Ищем свободного/i)).toBeNull();
    expect(screen.getByText(/отменена/i)).toBeInTheDocument();
  });

  it('при недоступном сокете сверяет заявку через REST и не теряет матч', async () => {
    connectRealtime.mockRejectedValue(new Error('offline'));
    apiFetch.mockResolvedValue({
      id: 'r1',
      status: 'MATCHED',
      consultationId: 'c-rest',
    });

    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        'requests/r1',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/ru/consultations/c-rest'),
    );
  });

  it('после ready сверяет REST и восстанавливает событие, пропущенное при подключении', async () => {
    connectRealtime.mockResolvedValue(connectedSocket());
    apiFetch.mockResolvedValue({
      id: 'r1',
      status: 'MATCHED',
      consultationId: 'c-missed',
    });

    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );
    await waitFor(() => expect(handlers.ready).toBeDefined());

    await act(async () => {
      handlers.ready({ expertId: null });
    });

    expect(apiFetch).toHaveBeenCalledWith(
      'requests/r1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/ru/consultations/c-missed'),
    );
  });

  it('ограничивает REST fallback и предлагает ручную проверку после исчерпания попыток', async () => {
    jest.useFakeTimers();
    connectRealtime.mockRejectedValue(new Error('offline'));
    apiFetch.mockRejectedValue(new Error('network'));

    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(2_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiFetch).toHaveBeenCalledTimes(3);
    expect(
      screen.getByRole('button', { name: /повторить проверку/i }),
    ).toBeEnabled();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });

  it('ручная проверка после offline запускает новый ограниченный цикл и находит матч', async () => {
    jest.useFakeTimers();
    connectRealtime.mockRejectedValue(new Error('offline'));
    apiFetch
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'MATCHED',
        consultationId: 'c-retry',
      });
    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(2_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /повторить проверку/i }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(push).toHaveBeenCalledWith('/ru/consultations/c-retry');
  });

  it('после ready выполняет свежий REST resync вслед за уже начатым, не перекрывая запросы', async () => {
    let resolveFallback!: (value: { id: string; status: 'SEARCHING' }) => void;
    let resolveReady!: (value: {
      id: string;
      status: 'MATCHED';
      consultationId: string;
    }) => void;
    apiFetch
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFallback = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveReady = resolve;
        }),
      );
    connectRealtime.mockResolvedValue(connectedSocket());
    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );
    await waitFor(() => expect(handlers.ready).toBeDefined());

    act(() => handlers.disconnect('transport close'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    act(() => handlers.ready({ expertId: null }));
    expect(apiFetch).toHaveBeenCalledTimes(1);

    resolveFallback({ id: 'r1', status: 'SEARCHING' });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);

    resolveReady({
      id: 'r1',
      status: 'MATCHED',
      consultationId: 'c-after-ready',
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/ru/consultations/c-after-ready'),
    );
  });

  it('не позволяет старому REST SEARCHING перезаписать MATCHED из сокета', async () => {
    let resolveRequest!: (value: { id: string; status: 'SEARCHING' }) => void;
    apiFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    connectRealtime.mockResolvedValue(connectedSocket());
    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );
    await waitFor(() => expect(handlers.ready).toBeDefined());

    act(() => handlers.ready({ expertId: null }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      handlers['request.updated']({
        id: 'r1',
        status: 'MATCHED',
        consultationId: 'c-socket-wins',
      });
      resolveRequest({ id: 'r1', status: 'SEARCHING' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(push).toHaveBeenCalledWith('/ru/consultations/c-socket-wins');
  });

  it('abort-ит REST resync и не навигирует после unmount', async () => {
    let resolveRequest!: (value: {
      id: string;
      status: 'MATCHED';
      consultationId: string;
    }) => void;
    let signal: AbortSignal | undefined;
    apiFetch.mockImplementation((_path: string, init?: RequestInit) => {
      signal = init?.signal as AbortSignal;
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    });
    connectRealtime.mockRejectedValue(new Error('offline'));
    const { unmount } = render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="ru"
      />,
    );
    await waitFor(() => expect(signal).toBeDefined());

    unmount();
    resolveRequest({ id: 'r1', status: 'MATCHED', consultationId: 'late' });
    await act(async () => {
      await Promise.resolve();
    });

    expect(signal?.aborted).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it('локализует offline recovery на казахский', async () => {
    jest.useFakeTimers();
    connectRealtime.mockRejectedValue(new Error('offline'));
    apiFetch.mockRejectedValue(new Error('network'));
    render(
      <RequestStatus
        requestId="r1"
        initial={{ id: 'r1', status: 'SEARCHING' }}
        locale="kz"
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(2_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Қайта тексеру' })).toBeEnabled();
  });
});
