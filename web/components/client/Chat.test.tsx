import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

const handlers: Record<string, (payload: unknown) => void> = {};
const send = jest.fn(() => true);
const close = jest.fn();
const connectRealtime = jest.fn();
jest.mock('@/lib/realtime/socket', () => ({
  connectRealtime: (...args: unknown[]) => connectRealtime(...args),
}));

function connectedSocket() {
  return {
    on: (event: string, handler: (payload: unknown) => void) => {
      handlers[event] = handler;
      return () => delete handlers[event];
    },
    onReady: (handler: (p: unknown) => void) => {
      handlers.ready = handler;
      return () => delete handlers.ready;
    },
    send,
    close,
  };
}

type HistoryResponse = { items: unknown[]; nextCursor?: string | null };
const history: HistoryResponse = { items: [] };
const apiFetch = jest.fn(
  async (_path: string, _init?: RequestInit): Promise<HistoryResponse> =>
    history,
);
jest.mock('@/lib/api/client', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetch(path, init),
  ApiError: class extends Error {},
}));

// eslint-disable-next-line import/first
import Chat from './Chat';

afterEach(() => {
  jest.clearAllMocks();
  history.items = [];
  for (const key of Object.keys(handlers)) delete handlers[key];
});

beforeEach(() => {
  connectRealtime.mockReset();
  apiFetch.mockReset();
  send.mockReset();
  send.mockReturnValue(true);
  connectRealtime.mockResolvedValue(connectedSocket());
  apiFetch.mockImplementation(async () => history);
});

const message = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  consultationId: 'c1',
  senderRole: 'EXPERT',
  text: 'Здравствуйте',
  createdAt: '2026-09-02T10:00:00.000Z',
  ...over,
});

async function serverReady() {
  await waitFor(() => expect(handlers.ready).toBeDefined());
  await act(async () => {
    handlers.ready({ expertId: null });
  });
}

describe('Chat', () => {
  it('подгружает историю переписки', async () => {
    history.items = [message()];
    render(<Chat consultationId="c1" />);

    expect(await screen.findByText('Здравствуйте')).toBeInTheDocument();
  });

  it('догружает историю по cursor до конца без потери последних сообщений', async () => {
    apiFetch
      .mockResolvedValueOnce({
        items: [message({ id: 'old', text: 'Старое' })],
        nextCursor: 'old',
      })
      .mockResolvedValueOnce({
        items: [message({ id: 'new', text: 'Новое' })],
        nextCursor: null,
      });

    render(<Chat consultationId="c1" readOnly />);

    expect(await screen.findByText('Старое')).toBeInTheDocument();
    expect(await screen.findByText('Новое')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      'consultations/c1/messages?limit=100',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      'consultations/c1/messages?limit=100&cursor=old',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('в режиме только чтения показывает историю без средств отправки', async () => {
    history.items = [message()];
    render(<Chat consultationId="c1" readOnly />);

    expect(await screen.findByText('Здравствуйте')).toBeInTheDocument();
    expect(screen.queryByLabelText('Сообщение')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Отправить' })).toBeNull();
  });

  it('показывает входящее сообщение из сокета', async () => {
    render(<Chat consultationId="c1" />);
    await waitFor(() => expect(handlers['chat.message']).toBeDefined());

    await act(async () => {
      handlers['chat.message'](
        message({ id: 'm2', text: 'Как вы себя чувствуете?' }),
      );
    });

    expect(screen.getByText('Как вы себя чувствуете?')).toBeInTheDocument();
  });

  it('не задваивает сообщение, пришедшее и историей, и сокетом', async () => {
    history.items = [message()];
    render(<Chat consultationId="c1" />);
    await screen.findByText('Здравствуйте');

    await act(async () => {
      handlers['chat.message'](message());
    });

    expect(screen.getAllByText('Здравствуйте')).toHaveLength(1);
  });

  it('при одинаковом createdAt сохраняет детерминированный порядок по id', async () => {
    history.items = [
      message({ id: 'm-b', text: 'Второе' }),
      message({ id: 'm-a', text: 'Первое' }),
    ];
    render(<Chat consultationId="c1" readOnly />);

    await screen.findByText('Первое');
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['Первое', 'Второе']);
  });

  it('не показывает сообщения чужой консультации', async () => {
    render(<Chat consultationId="c1" />);
    await waitFor(() => expect(handlers['chat.message']).toBeDefined());

    await act(async () => {
      handlers['chat.message'](
        message({ id: 'x', consultationId: 'c2', text: 'чужое' }),
      );
    });

    expect(screen.queryByText('чужое')).toBeNull();
  });

  it('отправляет сообщение событием, а не запросом', async () => {
    render(<Chat consultationId="c1" />);
    await serverReady();

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Спасибо' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(send).toHaveBeenCalledWith('chat.send', {
      consultationId: 'c1',
      text: 'Спасибо',
    });
  });

  it('не отправляет пустое сообщение', async () => {
    render(<Chat consultationId="c1" />);
    await serverReady();

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(send).not.toHaveBeenCalled();
  });

  it('не считает неоднозначный server echo ack и очищает draft только по решению пользователя', async () => {
    render(<Chat consultationId="c1" />);
    await serverReady();

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Спасибо' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(screen.getByLabelText('Сообщение')).toHaveValue('Спасибо');

    await act(async () => {
      handlers['chat.message'](
        message({ id: 'own-1', senderRole: 'CLIENT', text: 'Спасибо' }),
      );
    });

    expect(screen.getByLabelText('Сообщение')).toHaveValue('Спасибо');
    expect(screen.getByRole('alert')).toHaveTextContent(
      /похожее|clientMessageId/i,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /сообщение видно.*очистить черновик/i,
      }),
    );
    expect(screen.getByLabelText('Сообщение')).toHaveValue('');
  });

  it('не стирает новые правки draft, когда echo подтверждает предыдущий текст', async () => {
    render(<Chat consultationId="c1" />);
    await serverReady();
    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Первый текст' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Следующий текст' },
    });

    await act(async () => {
      handlers['chat.message'](
        message({ id: 'own-2', senderRole: 'CLIENT', text: 'Первый текст' }),
      );
    });

    expect(screen.getByLabelText('Сообщение')).toHaveValue('Следующий текст');
  });

  it('показывает ошибку отправки, а не молчит', async () => {
    render(<Chat consultationId="c1" />);
    await serverReady();
    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Поздно' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await act(async () => {
      handlers['chat.error']({ code: 'CONSULTATION_NOT_ACTIVE' });
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      /завершена|не активна/i,
    );
  });

  it('после подтверждённой chat.error сохраняет draft и разрешает явный retry', async () => {
    render(<Chat consultationId="c1" />);
    await serverReady();
    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Повторить безопасно' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await act(async () => {
      handlers['chat.error']({ code: 'CHAT_RATE_LIMITED' });
    });
    expect(screen.getByLabelText('Сообщение')).toHaveValue(
      'Повторить безопасно',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('игнорирует stale chat.error после уже подтверждённого echo', async () => {
    render(<Chat consultationId="c1" />);
    await serverReady();
    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Уже сохранено' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await act(async () => {
      handlers['chat.message'](
        message({
          id: 'own-confirmed',
          senderRole: 'CLIENT',
          text: 'Уже сохранено',
        }),
      );
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: /сообщение видно.*очистить черновик/i,
      }),
    );
    await act(async () => {
      handlers['chat.error']({ code: 'INTERNAL' });
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('');
  });

  it('без готового socket не отправляет и сохраняет draft для безопасного retry', async () => {
    connectRealtime.mockReturnValue(new Promise(() => undefined));
    render(<Chat consultationId="c1" />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Не потеряйте это' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(send).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Не потеряйте это');
    expect(screen.getByRole('alert')).toHaveTextContent(/не отправлено|связ/i);
  });

  it('не отправляет до server ready, даже если транспорт уже создан', async () => {
    render(<Chat consultationId="c1" />);
    await waitFor(() => expect(handlers.ready).toBeDefined());

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Слишком рано' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(send).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Слишком рано');
  });

  it('если socket отказал в emit после ready, сохраняет draft как точно не отправленный', async () => {
    send.mockReturnValueOnce(false);
    render(<Chat consultationId="c1" />);
    await serverReady();
    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Не ушло' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(screen.getByLabelText('Сообщение')).toHaveValue('Не ушло');
    expect(screen.getByRole('alert')).toHaveTextContent(/не отправлено/i);
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled();
  });

  it('после ready делает REST resync и восстанавливает пропущенное сообщение', async () => {
    apiFetch
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({
        items: [message({ id: 'missed', text: 'Пропущенное' })],
        nextCursor: null,
      });
    render(<Chat consultationId="c1" />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    await serverReady();

    expect(await screen.findByText('Пропущенное')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('при отсутствии echo сверяет REST, но требует ручного подтверждения похожего сообщения', async () => {
    jest.useFakeTimers();
    render(<Chat consultationId="c1" />);
    await serverReady();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    apiFetch.mockResolvedValueOnce({
      items: [
        message({
          id: 'persisted-own',
          senderRole: 'CLIENT',
          text: 'Проверить доставку',
        }),
      ],
      nextCursor: null,
    });

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Проверить доставку' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(screen.getByLabelText('Сообщение')).toHaveValue(
      'Проверить доставку',
    );

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Сообщение')).toHaveValue(
      'Проверить доставку',
    );
    expect(screen.getByText('Проверить доставку')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: /сообщение видно.*очистить черновик/i,
      }),
    );
    expect(screen.getByLabelText('Сообщение')).toHaveValue('');
  });

  it('после timeout без подтверждения не делает повторный emit и предлагает только REST-проверку', async () => {
    jest.useFakeTimers();
    render(<Chat consultationId="c1" />);
    await serverReady();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Не дублировать' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/неизвестно|провер/i);
    expect(
      screen.getByRole('button', { name: /проверить доставку/i }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
    expect(screen.getByLabelText('Сообщение')).toHaveValue('Не дублировать');

    fireEvent.click(
      screen.getByRole('button', { name: /проверить доставку/i }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('не принимает старое сообщение с тем же текстом за ack новой попытки', async () => {
    jest.useFakeTimers();
    history.items = [
      message({
        id: 'old-same',
        senderRole: 'CLIENT',
        text: 'Одинаковый текст',
      }),
    ];
    render(<Chat consultationId="c1" />);
    await screen.findByText('Одинаковый текст');
    await serverReady();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Одинаковый текст' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Сообщение')).toHaveValue('Одинаковый текст');
    expect(
      screen.getByRole('button', { name: /проверить доставку/i }),
    ).toBeEnabled();
  });

  it('abort-ит незавершённый history request при unmount', async () => {
    let signal: AbortSignal | undefined;
    apiFetch.mockImplementation(async (_path: string, init?: RequestInit) => {
      signal = init?.signal as AbortSignal;
      return await new Promise<HistoryResponse>(() => undefined);
    });
    const { unmount } = render(<Chat consultationId="c1" readOnly />);
    await waitFor(() => expect(signal).toBeDefined());

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('при навигации на другую консультацию удаляет старую историю', async () => {
    apiFetch.mockImplementation(async (path: string) => ({
      items: path.includes('/c1/')
        ? [message({ id: 'from-c1', text: 'Первая консультация' })]
        : [
            message({
              id: 'from-c2',
              consultationId: 'c2',
              text: 'Вторая консультация',
            }),
          ],
      nextCursor: null,
    }));
    const { rerender } = render(<Chat consultationId="c1" readOnly />);
    expect(await screen.findByText('Первая консультация')).toBeInTheDocument();

    rerender(<Chat consultationId="c2" readOnly />);

    expect(await screen.findByText('Вторая консультация')).toBeInTheDocument();
    expect(screen.queryByText('Первая консультация')).toBeNull();
  });

  it('не разрешает send, пока ready-resync истории ещё не завершён', async () => {
    let resolveHistory!: (value: {
      items: unknown[];
      nextCursor: null;
    }) => void;
    apiFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveHistory = resolve;
      }),
    );
    render(<Chat consultationId="c1" />);
    await serverReady();

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Жду сверку' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(send).not.toHaveBeenCalled();

    resolveHistory({ items: [], nextCursor: null });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('показывает ошибку истории и даёт повторить загрузку', async () => {
    apiFetch.mockRejectedValueOnce(new Error('offline'));
    render(<Chat consultationId="c1" readOnly locale="ru" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /переписк|соедин/i,
    );
    apiFetch.mockResolvedValueOnce({
      items: [message({ id: 'after-retry', text: 'После повтора' })],
      nextCursor: null,
    });
    fireEvent.click(
      screen.getByRole('button', { name: /повторить загрузку/i }),
    );

    expect(await screen.findByText('После повтора')).toBeInTheDocument();
  });

  it('локализует offline recovery на казахский', async () => {
    connectRealtime.mockRejectedValueOnce(new Error('offline'));
    render(<Chat consultationId="c1" locale="kz" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /байланыс|жіберілмейді/i,
    );
    expect(screen.getByLabelText('Хабарлама')).toBeInTheDocument();
  });

  it('после initial socket failure переподключается вручную и сохраняет draft', async () => {
    connectRealtime
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(connectedSocket());
    render(<Chat consultationId="c1" locale="ru" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/связь|чат/i);
    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Сохранённый черновик' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /повторить подключение/i }),
    );
    await serverReady();
    expect(screen.getByLabelText('Сообщение')).toHaveValue(
      'Сохранённый черновик',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(send).toHaveBeenCalledWith('chat.send', {
      consultationId: 'c1',
      text: 'Сохранённый черновик',
    });
  });

  it('после disconnect и нового ready подтверждает pending через REST без повторного emit', async () => {
    render(<Chat consultationId="c1" />);
    await serverReady();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Пережить reconnect' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await act(async () => {
      handlers.disconnect('transport close');
      await Promise.resolve();
      await Promise.resolve();
    });
    apiFetch.mockResolvedValueOnce({
      items: [
        message({
          id: 'after-reconnect',
          senderRole: 'CLIENT',
          text: 'Пережить reconnect',
        }),
      ],
      nextCursor: null,
    });

    await act(async () => {
      handlers.ready({ expertId: null });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Сообщение')).toHaveValue(
      'Пережить reconnect',
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /сообщение видно.*очистить черновик/i,
      }),
    );
    expect(screen.getByLabelText('Сообщение')).toHaveValue('');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('лента объявлена живой областью: новые сообщения читаются вслух', async () => {
    render(<Chat consultationId="c1" />);
    await waitFor(() => expect(handlers['chat.message']).toBeDefined());

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
  });
});
