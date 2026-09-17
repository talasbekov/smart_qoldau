import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ApiError, apiFetch } from '@/lib/api/client';
import { submitTicket } from '@/lib/api/guest-ticket';
import { createSupportStorage } from '@/lib/support-storage';
import ru from '@/messages/ru.json';
import SupportCenter from './SupportCenter';
import TicketConversation from './TicketConversation';
import SupportForm from '../SupportForm';

jest.mock('@/lib/api/client', () => ({
  ...jest.requireActual('@/lib/api/client'),
  apiFetch: jest.fn(),
}));
jest.mock('@/lib/api/guest-ticket', () => ({ submitTicket: jest.fn() }));
jest.mock('@/lib/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));

const fetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;
const guestMock = submitTicket as jest.MockedFunction<typeof submitTicket>;

const summary = (id: string, subject = 'Одинаковая тема') => ({
  id,
  subject,
  category: 'CONSULTATIONS' as const,
  status: 'NEW' as const,
  team: 'SUPPORT_OPERATOR' as const,
  createdAt: '2026-09-16T08:00:00.000Z',
  updatedAt: '2026-09-16T08:00:00.000Z',
});

const detail = (id: string) => ({
  ...summary(id, `Обращение ${id}`),
  body: `Исходное сообщение ${id}`,
  messages: [],
  firstReplyAt: null,
  resolvedAt: null,
  relatedConsultationId: null,
  relatedPayoutId: null,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function clientApi(tickets: unknown[] = []) {
  fetchMock.mockImplementation(async (path) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    return tickets;
  });
}

function fillCreate() {
  fireEvent.change(screen.getByLabelText('Тема'), {
    target: { value: 'Одинаковая тема' },
  });
  fireEvent.change(screen.getByLabelText('Описание'), {
    target: { value: 'Приватный текст A' },
  });
}

function renderGuest() {
  return render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <SupportForm />
    </NextIntlClientProvider>,
  );
}

function fillGuest() {
  fireEvent.change(screen.getByLabelText(ru.support.nameField), {
    target: { value: 'Гость' },
  });
  fireEvent.change(screen.getByLabelText(ru.support.contactField), {
    target: { value: 'guest@example.com' },
  });
  fireEvent.change(screen.getByLabelText(ru.support.messageField), {
    target: { value: 'Приватное сообщение' },
  });
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  guestMock.mockReset();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

it('isolates an authenticated draft when the account changes', async () => {
  clientApi();
  const view = render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fillCreate();

  view.rerender(<SupportCenter locale="ru" userId="user-b" />);
  await waitFor(() =>
    expect(screen.getByLabelText('Описание')).toHaveValue(''),
  );
  expect(createSupportStorage('user-a').readCreateDraft().status).toBe(
    'missing',
  );
  expect(createSupportStorage('user-b').readCreateDraft().status).toBe(
    'missing',
  );
});

it('never confirms a lost create from another tab matching its summary', async () => {
  let lists = 0;
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (init?.method === 'POST') throw new TypeError('response lost');
    return ++lists === 1 ? [] : [summary('other-tab')];
  });
  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fillCreate();
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));

  expect(
    await screen.findByText(/Исход отправки неизвестен/),
  ).toBeInTheDocument();
  expect(screen.queryByText('Обращение создано')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Описание')).toHaveValue('Приватный текст A');
});

it('persists the guest pending marker before awaiting the POST', async () => {
  const post = deferred<{ ok: false; error: 'UNKNOWN' }>();
  guestMock.mockReturnValue(post.promise);
  const first = renderGuest();
  fillGuest();
  fireEvent.click(screen.getByRole('button', { name: ru.support.submit }));
  expect(createSupportStorage('guest').readGuestPending().status).toBe('valid');
  await waitFor(() => expect(guestMock).toHaveBeenCalledTimes(1));

  first.unmount();
  renderGuest();
  expect(
    screen.getByRole('button', { name: ru.support.submit }),
  ).toBeDisabled();
  await act(async () => post.resolve({ ok: false, error: 'UNKNOWN' }));
  expect(createSupportStorage('guest').readGuestPending().status).toBe('valid');
});

it('finalizes a confirmed guest submission after navigation unmounts the UI', async () => {
  const post = deferred<{ ok: true }>();
  guestMock.mockReturnValue(post.promise);
  const storage = createSupportStorage('guest');
  const view = renderGuest();
  fillGuest();
  fireEvent.click(screen.getByRole('button', { name: ru.support.submit }));
  await waitFor(() => expect(guestMock).toHaveBeenCalledTimes(1));
  expect(storage.readGuestPending().status).toBe('valid');
  expect(storage.readGuestDraft().status).toBe('valid');

  view.unmount();
  await act(async () => post.resolve({ ok: true }));

  expect(storage.readGuestPending().status).toBe('missing');
  expect(storage.readGuestDraft().status).toBe('missing');
});

it('finalizes a definite guest rejection after navigation but keeps its draft', async () => {
  const post = deferred<{ ok: false; error: 'RATE_LIMITED' }>();
  guestMock.mockReturnValue(post.promise);
  const storage = createSupportStorage('guest');
  const view = renderGuest();
  fillGuest();
  fireEvent.click(screen.getByRole('button', { name: ru.support.submit }));
  await waitFor(() => expect(guestMock).toHaveBeenCalledTimes(1));

  view.unmount();
  await act(async () => post.resolve({ ok: false, error: 'RATE_LIMITED' }));

  expect(storage.readGuestPending().status).toBe('missing');
  expect(storage.readGuestDraft().status).toBe('valid');
});

it('preserves a newer guest marker and draft after an older success', async () => {
  const post = deferred<{ ok: true }>();
  guestMock.mockReturnValue(post.promise);
  const storage = createSupportStorage('guest');
  const view = renderGuest();
  fillGuest();
  fireEvent.click(screen.getByRole('button', { name: ru.support.submit }));
  await waitFor(() => expect(guestMock).toHaveBeenCalledTimes(1));
  const newerPending = {
    operationId: 'newer-guest-operation',
    draftRevision: 'newer-guest-revision',
    payload: {
      name: 'Новый гость',
      contact: 'new@example.com',
      message: 'Новый вопрос',
    },
  };
  storage.saveGuestPending(newerPending);
  storage.saveGuestDraft({
    revision: newerPending.draftRevision,
    payload: newerPending.payload,
  });

  view.unmount();
  await act(async () => post.resolve({ ok: true }));

  expect(storage.readGuestPending()).toEqual({
    status: 'valid',
    value: newerPending,
  });
  expect(storage.readGuestDraft()).toEqual({
    status: 'valid',
    value: {
      revision: newerPending.draftRevision,
      payload: newerPending.payload,
    },
  });
});

it('contains unavailable and quota-exhausted storage without crashing', async () => {
  fetchMock.mockResolvedValue(detail('A'));
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError');
  });
  expect(() =>
    render(<TicketConversation ticketId="A" locale="ru" userId="user-a" />),
  ).not.toThrow();
  await screen.findByText('Обращение A');
  cleanup();
  jest.restoreAllMocks();

  clientApi();
  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  expect(() =>
    fireEvent.change(screen.getByLabelText('Тема'), {
      target: { value: 'Черновик' },
    }),
  ).not.toThrow();
});

it('does not let a stale refresh unlock an in-flight create', async () => {
  const refresh = deferred<unknown[]>();
  const post = deferred<unknown>();
  let lists = 0;
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (init?.method === 'POST') return post.promise;
    return ++lists === 2 ? refresh.promise : [];
  });
  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fillCreate();
  fireEvent.click(screen.getByRole('button', { name: 'Обновить список' }));
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));
  await act(async () => refresh.resolve([]));
  expect(screen.getByLabelText('Описание')).toBeDisabled();
  await act(async () => post.resolve({ id: 'created' }));
});

it('removes a persisted draft after all create text is deleted', async () => {
  clientApi();
  const first = render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fillCreate();
  fireEvent.change(screen.getByLabelText('Тема'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Описание'), {
    target: { value: '' },
  });
  first.unmount();

  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  expect(screen.getByLabelText('Описание')).toHaveValue('');
});

it('blocks duplicate create when the stored pending record is malformed', async () => {
  const storage = createSupportStorage('user-a');
  localStorage.setItem(
    storage.keys.createPending,
    JSON.stringify({
      version: 1,
      ownerId: 'user-a',
      kind: 'create-pending',
      operationId: 'op',
      draftRevision: 'draft',
      payload: {
        category: 'CONSULTATIONS',
        subject: 'Тема',
        body: 'Текст',
      },
      baselineIds: {},
    }),
  );
  clientApi();
  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');

  expect(
    screen.getByRole('button', { name: 'Создать обращение' }),
  ).toBeDisabled();
  expect(screen.getByText(/отметка.*повреждена/i)).toBeInTheDocument();
});

it('ignores the previous ticket POST completion after a route change', async () => {
  const post = deferred<unknown>();
  fetchMock.mockImplementation(async (path, init) =>
    init?.method === 'POST' ? post.promise : detail(String(path).split('/')[1]),
  );
  const view = render(
    <TicketConversation ticketId="A" locale="ru" userId="user-a" />,
  );
  await screen.findByLabelText('Ваш ответ');
  fireEvent.change(screen.getByLabelText('Ваш ответ'), {
    target: { value: 'Ответ A' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));

  view.rerender(
    <TicketConversation ticketId="B" locale="ru" userId="user-a" />,
  );
  await screen.findByText('Обращение B');
  fireEvent.change(screen.getByLabelText('Ваш ответ'), {
    target: { value: 'Новый черновик B' },
  });
  await act(async () => post.resolve(null));
  expect(screen.getByText('Обращение B')).toBeInTheDocument();
  expect(screen.getByLabelText('Ваш ответ')).toHaveValue('Новый черновик B');
});

it('never confirms a lost reply from an identical message in another tab', async () => {
  let gets = 0;
  fetchMock.mockImplementation(async (_path, init) => {
    if (init?.method === 'POST') throw new TypeError('request not sent');
    const result = detail('A');
    if (++gets === 1) return result;
    return {
      ...result,
      messages: [
        {
          id: 'other-tab',
          authorKind: 'user',
          body: 'Спасибо',
          createdAt: '2026-09-16T08:01:00.000Z',
        },
      ],
    };
  });
  render(<TicketConversation ticketId="A" locale="ru" userId="user-a" />);
  await screen.findByLabelText('Ваш ответ');
  fireEvent.change(screen.getByLabelText('Ваш ответ'), {
    target: { value: 'Спасибо' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));

  expect(
    await screen.findByText(/Исход отправки ответа неизвестен/),
  ).toBeInTheDocument();
  expect(screen.queryByText('Ответ отправлен')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Ваш ответ')).toHaveValue('Спасибо');
});
