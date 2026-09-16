import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

const apiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
}));

// eslint-disable-next-line import/first
import WorkStatusToggle from './WorkStatusToggle';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  });
  apiFetch.mockImplementation((path: string, init?: RequestInit) => {
    if (path === 'experts/me/work-status') {
      const workStatus = JSON.parse(String(init?.body)).workStatus;
      return Promise.resolve({ workStatus });
    }
    if (path === 'experts/me') {
      return Promise.resolve({ workStatus: 'NOT_ACCEPTING' });
    }
    return Promise.resolve(null);
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

async function setHidden(hidden: boolean) {
  await act(async () => {
    Object.defineProperty(document, 'visibilityState', {
      value: hidden ? 'hidden' : 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
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

  it('состояние выражено через aria-checked, а не только цветом', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  });

  it('пока вкладка открыта, шлёт heartbeat', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        'experts/me/heartbeat',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('скрытая вкладка перестаёт слать heartbeat: иначе онлайн — обман', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    await setHidden(true);
    apiFetch.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    // В приложении статус держит фоновая служба, в браузере её нет.
    // «Принимаю клиентов» у закрытой вкладки — офферы в пустоту.
    expect(apiFetch).not.toHaveBeenCalledWith(
      'experts/me/heartbeat',
      expect.anything(),
    );
  });

  it('возврат на вкладку возобновляет heartbeat', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    await setHidden(true);
    apiFetch.mockClear();
    await setHidden(false);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        'experts/me/work-status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ workStatus: 'ACCEPTING' }),
        }),
      ),
    );
  });

  it('переход канонического BUSY в ACCEPTING возобновляет heartbeat без hide/show', async () => {
    const view = render(<WorkStatusToggle initial="BUSY" />);

    view.rerender(<WorkStatusToggle initial="ACCEPTING" />);
    await act(async () => jest.advanceTimersByTime(60_000));

    expect(screen.getByRole('switch')).toBeEnabled();
    expect(apiFetch).toHaveBeenCalledWith(
      'experts/me/heartbeat',
      expect.anything(),
    );
  });

  it('после completion status-resync снимает BUSY даже при неизменном initial ACCEPTING', async () => {
    let serverStatus = 'ACCEPTING';
    apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === 'experts/me') return { workStatus: serverStatus };
      if (init?.body) {
        serverStatus = JSON.parse(String(init.body)).workStatus;
      }
      return { workStatus: serverStatus };
    });
    render(<WorkStatusToggle initial="ACCEPTING" />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());

    serverStatus = 'BUSY';
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('sq:expert-work-status', { detail: 'BUSY' }),
      );
    });
    expect(screen.getByRole('switch')).toBeDisabled();
    serverStatus = 'ACCEPTING';
    await act(async () => {
      window.dispatchEvent(new Event('sq:expert-work-status-sync'));
    });

    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        'experts/me/heartbeat',
        expect.anything(),
      ),
    );
  });

  it('выключение прекращает heartbeat', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() =>
      expect(screen.getByRole('switch')).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    );
    apiFetch.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(apiFetch).not.toHaveBeenCalledWith(
      'experts/me/heartbeat',
      expect.anything(),
    );
  });

  it('объясняет, почему онлайн держится только на открытой вкладке', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);

    expect(screen.getByText(/вкладк/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
  });

  it('скрытие вкладки сразу снимает server status, а не ждёт stale timeout', async () => {
    render(<WorkStatusToggle initial="ACCEPTING" />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    apiFetch.mockClear();

    await setHidden(true);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        'experts/me/work-status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ workStatus: 'NOT_ACCEPTING' }),
        }),
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent(/приостановлен/i);
  });

  it('сериализует поздний ACCEPTING перед NOT_ACCEPTING скрытой вкладки', async () => {
    let resolveAccepting!: (value: unknown) => void;
    apiFetch.mockImplementationOnce(
      () => new Promise((resolve) => (resolveAccepting = resolve)),
    );
    render(<WorkStatusToggle initial="ACCEPTING" />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    await setHidden(true);
    await act(async () => resolveAccepting({ workStatus: 'ACCEPTING' }));

    await waitFor(() =>
      expect(
        apiFetch.mock.calls.filter(
          ([path]) => path === 'experts/me/work-status',
        ),
      ).toHaveLength(2),
    );
    const statusCalls = apiFetch.mock.calls.filter(
      ([path]) => path === 'experts/me/work-status',
    );
    expect(JSON.parse(String(statusCalls[0][1].body)).workStatus).toBe(
      'ACCEPTING',
    );
    expect(JSON.parse(String(statusCalls[1][1].body)).workStatus).toBe(
      'NOT_ACCEPTING',
    );
    expect(apiFetch).not.toHaveBeenCalledWith(
      'experts/me/heartbeat',
      expect.anything(),
    );
  });

  it('компенсирует включение, если вкладку скрыли до ответа PATCH', async () => {
    const patch = deferred<{ workStatus: string }>();
    let serverStatus = 'NOT_ACCEPTING';
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      const requested = init?.body
        ? JSON.parse(String(init.body)).workStatus
        : null;
      if (path === 'experts/me/work-status' && requested === 'ACCEPTING') {
        return patch.promise.then(() => {
          serverStatus = requested;
          return { workStatus: requested };
        });
      }
      if (path === 'experts/me/work-status' && requested) {
        serverStatus = requested;
      }
      return Promise.resolve({ workStatus: serverStatus });
    });
    render(<WorkStatusToggle initial="NOT_ACCEPTING" />);

    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    await setHidden(true);
    await act(async () => patch.resolve({ workStatus: 'ACCEPTING' }));

    await waitFor(() => expect(serverStatus).toBe('NOT_ACCEPTING'));
  });

  it('компенсирует включение, если компонент размонтирован до ответа PATCH', async () => {
    const patch = deferred<{ workStatus: string }>();
    let serverStatus = 'NOT_ACCEPTING';
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      const requested = init?.body
        ? JSON.parse(String(init.body)).workStatus
        : null;
      if (path === 'experts/me/work-status' && requested === 'ACCEPTING') {
        return patch.promise.then(() => {
          serverStatus = requested;
          return { workStatus: requested };
        });
      }
      if (path === 'experts/me/work-status' && requested) {
        serverStatus = requested;
      }
      return Promise.resolve({ workStatus: serverStatus });
    });
    const view = render(<WorkStatusToggle initial="NOT_ACCEPTING" />);

    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => patch.resolve({ workStatus: 'ACCEPTING' }));

    await waitFor(() => expect(serverStatus).toBe('NOT_ACCEPTING'));
  });

  it('после lost PATCH и lost GET скрытие всё равно снимает поздний ACCEPTING', async () => {
    const get = deferred<{ workStatus: string }>();
    let serverStatus = 'NOT_ACCEPTING';
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      const requested = init?.body
        ? JSON.parse(String(init.body)).workStatus
        : null;
      if (path === 'experts/me/work-status' && requested === 'ACCEPTING') {
        serverStatus = 'ACCEPTING';
        return Promise.reject(new TypeError('PATCH response lost'));
      }
      if (path === 'experts/me') return get.promise;
      if (path === 'experts/me/work-status' && requested) {
        serverStatus = requested;
      }
      return Promise.resolve({ workStatus: serverStatus });
    });
    render(<WorkStatusToggle initial="NOT_ACCEPTING" />);

    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('experts/me'));
    await setHidden(true);
    await act(async () => get.reject(new TypeError('GET response lost')));

    await waitFor(() => expect(serverStatus).toBe('NOT_ACCEPTING'));
  });

  it('после завершённых lost PATCH и lost GET позднее скрытие сохраняет обязанность compensation', async () => {
    let serverStatus = 'NOT_ACCEPTING';
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === 'experts/me') {
        return Promise.reject(new TypeError('GET response lost'));
      }
      if (init?.body) {
        serverStatus = JSON.parse(String(init.body)).workStatus;
        if (serverStatus === 'ACCEPTING') {
          return Promise.reject(new TypeError('PATCH response lost'));
        }
      }
      return Promise.resolve({ workStatus: serverStatus });
    });
    render(<WorkStatusToggle initial="NOT_ACCEPTING" />);

    fireEvent.click(screen.getByRole('switch'));
    await screen.findByRole('alert');
    await setHidden(true);

    await waitFor(() => expect(serverStatus).toBe('NOT_ACCEPTING'));
  });

  it('старый retry hide завершается до нового resume ACCEPTING', async () => {
    const failedOffline = deferred<never>();
    let serverStatus = 'ACCEPTING';
    let offlineCalls = 0;
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === 'experts/me') {
        return Promise.resolve({ workStatus: serverStatus });
      }
      if (init?.body) {
        const target = JSON.parse(String(init.body)).workStatus;
        if (target === 'NOT_ACCEPTING' && ++offlineCalls === 1) {
          return failedOffline.promise;
        }
        serverStatus = target;
      }
      return Promise.resolve({ workStatus: serverStatus });
    });
    render(<WorkStatusToggle initial="ACCEPTING" />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());

    await setHidden(true);
    await waitFor(() => expect(offlineCalls).toBe(1));
    await setHidden(false);
    await act(async () =>
      failedOffline.reject(new TypeError('lost offline response')),
    );

    await waitFor(() => expect(offlineCalls).toBe(2));
    await waitFor(() => expect(serverStatus).toBe('ACCEPTING'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('не перезаписывает канонический BUSY при hide/show', async () => {
    let serverStatus = 'ACCEPTING';
    apiFetch.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.body) {
        serverStatus = JSON.parse(String(init.body)).workStatus;
      }
      return { workStatus: serverStatus };
    });
    const view = render(<WorkStatusToggle initial="ACCEPTING" />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());

    serverStatus = 'BUSY';
    view.rerender(<WorkStatusToggle initial="BUSY" />);
    await setHidden(true);
    await setHidden(false);

    expect(serverStatus).toBe('BUSY');
  });

  it('REST-resync сверяет канонический статус до следующего resume', async () => {
    let serverStatus = 'ACCEPTING';
    apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.body) {
        serverStatus = JSON.parse(String(init.body)).workStatus;
      }
      if (path === 'experts/me') return { workStatus: serverStatus };
      return { workStatus: serverStatus };
    });
    render(<WorkStatusToggle initial="ACCEPTING" />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    serverStatus = 'BUSY';
    apiFetch.mockClear();

    await act(async () => {
      window.dispatchEvent(new Event('sq:expert-work-status-sync'));
    });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('experts/me'));
    await waitFor(() =>
      expect(screen.getByRole('switch')).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    );
    await setHidden(true);
    await setHidden(false);
    expect(serverStatus).toBe('BUSY');
  });

  it('поздний ответ ACCEPTING не отменяет более новый канонический BUSY', async () => {
    const patch = deferred<{ workStatus: string }>();
    apiFetch.mockImplementationOnce(() => patch.promise);
    render(<WorkStatusToggle initial="NOT_ACCEPTING" />);

    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('sq:expert-work-status', { detail: 'BUSY' }),
      );
    });
    await act(async () => patch.resolve({ workStatus: 'ACCEPTING' }));

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('не показывает переключение успешным, когда сервер его отклонил', async () => {
    apiFetch
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('still offline'));
    render(<WorkStatusToggle initial="NOT_ACCEPTING" />);

    fireEvent.click(screen.getByRole('switch'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/подтвердить/i);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('сверяет неизвестный PATCH через GET и принимает подтверждённый статус', async () => {
    apiFetch
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce({ workStatus: 'ACCEPTING' });
    render(<WorkStatusToggle initial="NOT_ACCEPTING" />);

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('experts/me'));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('не отправляет два PATCH по двойному нажатию', async () => {
    let resolvePatch!: (value: unknown) => void;
    apiFetch.mockImplementationOnce(
      () => new Promise((resolve) => (resolvePatch = resolve)),
    );
    render(<WorkStatusToggle initial="NOT_ACCEPTING" />);
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    await act(async () => resolvePatch({ workStatus: 'ACCEPTING' }));
  });

  it('локализует статус для казахского кабинета', () => {
    render(<WorkStatusToggle initial="NOT_ACCEPTING" locale="kz" />);

    expect(screen.getByRole('switch')).toHaveTextContent('Қабылдамаймын');
  });
});
