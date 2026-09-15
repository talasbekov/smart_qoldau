import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

const handlers: Record<string, (payload: unknown) => void> = {};
const send = jest.fn();
const close = jest.fn();
jest.mock('@/lib/realtime/socket', () => ({
  connectRealtime: async () => ({
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
  }),
}));

const history = { items: [] as unknown[] };
jest.mock('@/lib/api/client', () => ({
  apiFetch: async () => history,
  ApiError: class extends Error {},
}));

// eslint-disable-next-line import/first
import Chat from './Chat';

afterEach(() => {
  jest.clearAllMocks();
  history.items = [];
  for (const key of Object.keys(handlers)) delete handlers[key];
});

const message = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  consultationId: 'c1',
  senderRole: 'EXPERT',
  text: 'Здравствуйте',
  createdAt: '2026-09-02T10:00:00.000Z',
  ...over,
});

describe('Chat', () => {
  it('подгружает историю переписки', async () => {
    history.items = [message()];
    render(<Chat consultationId="c1" />);

    expect(await screen.findByText('Здравствуйте')).toBeInTheDocument();
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
    await waitFor(() => expect(handlers['chat.message']).toBeDefined());

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
    await waitFor(() => expect(handlers['chat.message']).toBeDefined());

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(send).not.toHaveBeenCalled();
  });

  it('очищает поле после отправки', async () => {
    render(<Chat consultationId="c1" />);
    await waitFor(() => expect(handlers['chat.message']).toBeDefined());

    fireEvent.change(screen.getByLabelText('Сообщение'), {
      target: { value: 'Спасибо' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(screen.getByLabelText('Сообщение')).toHaveValue('');
  });

  it('показывает ошибку отправки, а не молчит', async () => {
    render(<Chat consultationId="c1" />);
    await waitFor(() => expect(handlers['chat.error']).toBeDefined());

    await act(async () => {
      handlers['chat.error']({ code: 'CONSULTATION_NOT_ACTIVE' });
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      /завершена|не активна/i,
    );
  });

  it('лента объявлена живой областью: новые сообщения читаются вслух', async () => {
    render(<Chat consultationId="c1" />);
    await waitFor(() => expect(handlers['chat.message']).toBeDefined());

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
  });
});
