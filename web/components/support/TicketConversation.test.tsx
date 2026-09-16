import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { apiFetch } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => ({
  ...jest.requireActual('@/lib/api/client'),
  apiFetch: jest.fn(),
}));
jest.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

// eslint-disable-next-line import/first
import TicketConversation from './TicketConversation';

const fetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

function detail(status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' = 'IN_PROGRESS') {
  return {
    id: 'ticket-1',
    category: 'TECHNICAL' as const,
    subject: 'Камера не работает',
    status,
    team: 'SUPPORT_OPERATOR' as const,
    createdAt: '2026-09-16T08:00:00.000Z',
    updatedAt: '2026-09-16T08:05:00.000Z',
    body: 'После обновления камера не включается.',
    firstReplyAt: '2026-09-16T08:03:00.000Z',
    resolvedAt: status === 'RESOLVED' ? '2026-09-16T08:10:00.000Z' : null,
    relatedConsultationId: null,
    relatedPayoutId: null,
    messages: [
      {
        id: 'message-1',
        authorKind: 'staff' as const,
        body: 'Уточните модель устройства.',
        createdAt: '2026-09-16T08:03:00.000Z',
      },
    ],
  };
}

describe('TicketConversation', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
  });

  it('renders the thread and makes a resolved ticket read-only', async () => {
    fetchMock.mockResolvedValue(detail('RESOLVED'));
    render(
      <TicketConversation ticketId="ticket-1" locale="ru" userId="user-1" />,
    );

    expect(screen.getByText('Загружаем обращение…')).toBeInTheDocument();
    expect(await screen.findByText('Камера не работает')).toBeInTheDocument();
    expect(screen.getByText('Решён')).toBeInTheDocument();
    expect(
      screen.getByText(/Ответить на решённое обращение нельзя/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Ваш ответ')).toBeNull();
  });

  it('locks double click while an author reply is in flight', async () => {
    let resolveReply: (value: unknown) => void = () => undefined;
    const pendingReply = new Promise((resolve) => {
      resolveReply = resolve;
    });
    fetchMock.mockImplementation(async (path, init) => {
      if (init?.method === 'POST') return pendingReply;
      return detail();
    });
    render(
      <TicketConversation ticketId="ticket-1" locale="ru" userId="user-1" />,
    );
    await screen.findByLabelText('Ваш ответ');

    fireEvent.change(screen.getByLabelText('Ваш ответ'), {
      target: { value: 'Модель устройства — Pixel 8.' },
    });
    const submit = screen.getByRole('button', { name: 'Отправить ответ' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
      ).toHaveLength(1),
    );
    resolveReply(null);
    await waitFor(() =>
      expect(screen.getByText('Ответ отправлен')).toBeInTheDocument(),
    );
  });

  it('does not let a late detail response replace a newer route', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    fetchMock.mockImplementation(async (path) => {
      if (path === 'tickets/ticket-1') return first;
      return { ...detail(), id: 'ticket-2', subject: 'Второе обращение' };
    });
    const { rerender } = render(
      <TicketConversation ticketId="ticket-1" locale="ru" userId="user-1" />,
    );

    rerender(
      <TicketConversation ticketId="ticket-2" locale="ru" userId="user-1" />,
    );
    expect(await screen.findByText('Второе обращение')).toBeInTheDocument();
    await act(async () => {
      resolveFirst(detail());
    });

    expect(screen.queryByText('Камера не работает')).toBeNull();
    expect(screen.getByText('Второе обращение')).toBeInTheDocument();
  });

  it('does not call a missing message a failure after a lost POST response', async () => {
    fetchMock.mockImplementation(async (_path, init) => {
      if (init?.method === 'POST') throw new TypeError('response lost');
      return detail();
    });
    render(
      <TicketConversation ticketId="ticket-1" locale="ru" userId="user-1" />,
    );
    await screen.findByLabelText('Ваш ответ');

    fireEvent.change(screen.getByLabelText('Ваш ответ'), {
      target: { value: 'Модель устройства — Pixel 8.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));

    expect(
      await screen.findByText(/Исход отправки ответа неизвестен/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Ваш ответ')).toHaveValue(
      'Модель устройства — Pixel 8.',
    );
    expect(
      screen.getByRole('button', { name: 'Отправить ответ' }),
    ).toBeDisabled();
  });
});
