import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ApiError, apiFetch } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client');
  return { ...actual, apiFetch: jest.fn() };
});
jest.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

// eslint-disable-next-line import/first
import SupportCenter from './SupportCenter';

const fetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

const ticket = {
  id: 'ticket-1',
  category: 'TECHNICAL' as const,
  subject: 'Камера не работает',
  status: 'IN_PROGRESS' as const,
  team: 'SUPPORT_OPERATOR' as const,
  createdAt: '2026-09-16T08:00:00.000Z',
  updatedAt: '2026-09-16T08:05:00.000Z',
};

function clientApi(initialTickets: unknown[] = []) {
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (path === 'tickets' && init?.method === 'POST') {
      return {
        id: 'ticket-created',
        category: 'TECHNICAL',
        status: 'NEW',
        team: 'SUPPORT_OPERATOR',
        createdAt: '2026-09-16T09:00:00.000Z',
      };
    }
    if (path.startsWith('tickets')) return initialTickets;
    return null;
  });
}

describe('SupportCenter', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
  });

  it('shows an honest loading state, then localized own tickets', async () => {
    clientApi([ticket]);
    render(<SupportCenter locale="ru" />);

    expect(screen.getByText('Загружаем обращения…')).toBeInTheDocument();
    expect(await screen.findByText('Камера не работает')).toBeInTheDocument();
    expect(screen.getByText('В работе')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Открыть обращение' }),
    ).toHaveAttribute('href', '/support/requests/ticket-1');
  });

  it('offers only client categories after the server-backed role probe', async () => {
    clientApi();
    render(<SupportCenter locale="ru" />);

    const category = await screen.findByLabelText('Категория');
    expect(category).toHaveTextContent('Данные аккаунта');
    expect(category).not.toHaveTextContent('Выплаты');
    expect(screen.getByText('Обращений пока нет')).toBeInTheDocument();
  });

  it('ignores a late list response after a newer refresh has completed', async () => {
    let resolveOld: (value: unknown) => void = () => undefined;
    let resolveNew: (value: unknown) => void = () => undefined;
    const oldRefresh = new Promise((resolve) => {
      resolveOld = resolve;
    });
    const newRefresh = new Promise((resolve) => {
      resolveNew = resolve;
    });
    let listCall = 0;
    fetchMock.mockImplementation(async (path) => {
      if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
      if (path.startsWith('tickets')) {
        listCall += 1;
        if (listCall === 1) return [ticket];
        return listCall === 2 ? oldRefresh : newRefresh;
      }
      return null;
    });
    render(<SupportCenter locale="ru" />);
    await screen.findByText('Камера не работает');
    const refresh = screen.getByRole('button', { name: 'Обновить список' });

    fireEvent.click(refresh);
    expect(refresh).toHaveTextContent('Обновляем…');
    fireEvent.click(refresh);
    await act(async () => {
      resolveNew([{ ...ticket, id: 'new', subject: 'Новый снимок' }]);
    });
    expect(await screen.findByText('Новый снимок')).toBeInTheDocument();

    await act(async () => {
      resolveOld([{ ...ticket, id: 'old', subject: 'Устаревший снимок' }]);
    });
    expect(screen.queryByText('Устаревший снимок')).toBeNull();
    expect(screen.getByText('Новый снимок')).toBeInTheDocument();
  });

  it('does not silently classify a failed role probe as a client', async () => {
    fetchMock.mockImplementation(async (path) => {
      if (path === 'experts/me') throw new ApiError(503, 'UNAVAILABLE');
      return [];
    });
    render(<SupportCenter locale="ru" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось загрузить обращения',
    );
    expect(screen.queryByLabelText('Категория')).toBeNull();
  });

  it('submits once on a double click and never sends contact fields', async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    const pendingCreate = new Promise((resolve) => {
      resolveCreate = resolve;
    });
    fetchMock.mockImplementation(async (path, init) => {
      if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
      if (path === 'tickets' && init?.method === 'POST') return pendingCreate;
      if (path.startsWith('tickets')) return [];
      return null;
    });
    render(<SupportCenter locale="ru" />);
    await screen.findByLabelText('Категория');

    fireEvent.change(screen.getByLabelText('Тема'), {
      target: { value: 'Не работает камера' },
    });
    fireEvent.change(screen.getByLabelText('Описание'), {
      target: { value: 'После обновления камера не включается.' },
    });
    const submit = screen.getByRole('button', { name: 'Создать обращение' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    const createCalls = fetchMock.mock.calls.filter(
      ([path, init]) => path === 'tickets' && init?.method === 'POST',
    );
    expect(createCalls).toHaveLength(1);
    expect(JSON.parse(String(createCalls[0][1]?.body))).toEqual({
      category: 'CONSULTATIONS',
      subject: 'Не работает камера',
      body: 'После обновления камера не включается.',
    });

    resolveCreate({
      id: 'ticket-created',
      category: 'CONSULTATIONS',
      status: 'NEW',
      team: 'SUPPORT_OPERATOR',
      createdAt: '2026-09-16T09:00:00.000Z',
    });
    await waitFor(() =>
      expect(screen.getByText('Обращение создано')).toBeInTheDocument(),
    );
  });

  it('keeps the draft and blocks blind retry when POST outcome is unknown', async () => {
    fetchMock.mockImplementation(async (path, init) => {
      if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
      if (path === 'tickets' && init?.method === 'POST') {
        throw new TypeError('response lost');
      }
      if (path.startsWith('tickets')) return [];
      return null;
    });
    render(<SupportCenter locale="ru" />);
    await screen.findByLabelText('Категория');

    fireEvent.change(screen.getByLabelText('Тема'), {
      target: { value: 'Не работает камера' },
    });
    fireEvent.change(screen.getByLabelText('Описание'), {
      target: { value: 'Черновик остаётся на месте.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));

    expect(
      await screen.findByText(/Исход отправки неизвестен/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Тема')).toHaveValue('Не работает камера');
    expect(
      screen.getByRole('button', { name: 'Создать обращение' }),
    ).toBeDisabled();
    expect(
      localStorage.getItem('smartqoldau:support:create:pending'),
    ).toContain('Не работает камера');
  });
});
