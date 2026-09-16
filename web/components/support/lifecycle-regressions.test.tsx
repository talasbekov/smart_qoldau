import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ApiError, apiFetch } from '@/lib/api/client';
import {
  activateSupportOwner,
  clearAllSupportStorage,
  clearOtherSupportStorage,
  createSupportStorage,
  supportSessionEpochKey,
} from '@/lib/support-storage';
import SupportCenter from './SupportCenter';
import TicketConversation from './TicketConversation';

jest.mock('@/lib/api/client', () => ({
  ...jest.requireActual('@/lib/api/client'),
  apiFetch: jest.fn(),
}));
jest.mock('@/lib/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));

const fetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;
const ownerStorage = createSupportStorage('user-a');
const payload = {
  category: 'CONSULTATIONS' as const,
  subject: 'Одинаковая тема',
  body: 'Приватный текст',
};
const pending = {
  operationId: 'operation-a',
  draftRevision: 'revision-a',
  payload,
  baselineIds: [] as string[],
};
const summary = {
  id: 'ticket-a',
  category: 'CONSULTATIONS' as const,
  subject: 'Ticket A',
  status: 'NEW' as const,
  team: 'SUPPORT_OPERATOR' as const,
  createdAt: '2026-09-16T08:00:00Z',
  updatedAt: '2026-09-16T08:00:00Z',
};
const detail = {
  ...summary,
  body: 'Initial',
  messages: [],
  firstReplyAt: null,
  resolvedAt: null,
  relatedConsultationId: null,
  relatedPayoutId: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function clientApi() {
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (init?.method === 'POST') throw new TypeError('lost response');
    return path.includes('ticket-a') ? detail : [];
  });
}

function fill() {
  fireEvent.change(screen.getByLabelText('Тема'), {
    target: { value: payload.subject },
  });
  fireEvent.change(screen.getByLabelText('Описание'), {
    target: { value: payload.body },
  });
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  clientApi();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

it('retains unknown blocking but removes private text on logout', async () => {
  const first = render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));
  await screen.findByText(/Исход отправки неизвестен/);

  clearAllSupportStorage();
  first.unmount();
  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');

  expect(screen.getByLabelText('Описание')).toHaveValue('');
  expect(
    screen.getByRole('button', { name: 'Создать обращение' }),
  ).toBeDisabled();
});

it('retains an unknown reply when another account activates', async () => {
  ownerStorage.saveReplyPending('ticket-a', {
    operationId: 'operation-reply',
    draftRevision: 'revision-reply',
    payload: { body: 'Unknown reply' },
    baselineIds: [],
  });
  clearOtherSupportStorage('user-b');

  render(
    <TicketConversation ticketId="ticket-a" locale="ru" userId="user-a" />,
  );
  await screen.findByLabelText('Ваш ответ');
  expect(
    screen.getByRole('button', { name: 'Отправить ответ' }),
  ).toBeDisabled();
  expect(screen.getByLabelText('Ваш ответ')).toHaveValue('');
});

it('does not erase a guest unknown when authenticated support opens', () => {
  const guest = createSupportStorage('guest');
  guest.saveGuestPending({
    operationId: 'guest-operation',
    draftRevision: 'guest-revision',
    payload: { name: 'Guest', contact: 'g@example.com', message: 'Unknown' },
  });

  clearOtherSupportStorage('user-a');

  expect(guest.readGuestPending().status).not.toBe('missing');
});

it('turns a legacy pending into conservative blocking', async () => {
  localStorage.setItem(
    'smartqoldau:support:create:pending',
    JSON.stringify({
      category: 'CONSULTATIONS',
      subject: 'Unknown',
      baselineIds: [],
    }),
  );

  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  expect(
    screen.getByRole('button', { name: 'Создать обращение' }),
  ).toBeDisabled();
});

it('an already-mounted tab respects a pending created by another tab', async () => {
  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fill();
  ownerStorage.saveCreatePending(pending);
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: ownerStorage.keys.createPending,
        newValue: localStorage.getItem(ownerStorage.keys.createPending),
      }),
    );
  });

  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));
  await act(async () => undefined);

  expect(
    fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(0);
  expect(ownerStorage.readCreatePending()).toEqual({
    status: 'valid',
    value: pending,
  });
});

it('a stale owner tab is invalidated before it can mutate the new session', async () => {
  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fill();
  clearAllSupportStorage();
  activateSupportOwner('user-b');
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', { key: supportSessionEpochKey }),
    );
  });

  expect(screen.getByLabelText('Описание')).toHaveValue('');
  expect(
    screen.getByRole('button', { name: 'Создать обращение' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));
  await act(async () => undefined);
  expect(
    fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(0);
});

it('a server owner-mismatch response invalidates a tab even without a storage event', async () => {
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (init?.method === 'POST') {
      throw new ApiError(409, 'SUPPORT_SESSION_CHANGED');
    }
    return [];
  });
  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));

  expect(await screen.findByText(/Аккаунт в браузере изменился/)).toBeVisible();
  expect(screen.getByLabelText('Описание')).toHaveValue('');
  expect(
    screen.getByRole('button', { name: 'Создать обращение' }),
  ).toBeDisabled();
});

it('an older successful POST cannot delete another tab newer draft', async () => {
  let resolvePost!: (value: unknown) => void;
  const post = new Promise((resolve) => {
    resolvePost = resolve;
  });
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (init?.method === 'POST') return post;
    return [];
  });
  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));
  ownerStorage.saveCreateDraft({
    revision: 'newer-from-other-tab',
    payload: {
      category: 'CONSULTATIONS',
      subject: 'New',
      body: 'Keep me',
    },
  });

  await act(async () => resolvePost({ id: 'created' }));
  await screen.findByText('Обращение создано');

  expect(ownerStorage.readCreateDraft()).toEqual({
    status: 'valid',
    value: {
      revision: 'newer-from-other-tab',
      payload: {
        category: 'CONSULTATIONS',
        subject: 'New',
        body: 'Keep me',
      },
    },
  });
});

it('finalizes a confirmed create after navigation unmounts the UI', async () => {
  const post = deferred<unknown>();
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (init?.method === 'POST') return post.promise;
    return [];
  });
  const view = render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(1),
  );
  expect(ownerStorage.readCreatePending().status).toBe('valid');

  view.unmount();
  await act(async () => post.resolve({ id: 'created' }));

  expect(ownerStorage.readCreatePending().status).toBe('missing');
  expect(ownerStorage.readCreateDraft().status).toBe('missing');
});

it('finalizes a confirmed reply after navigation unmounts the UI', async () => {
  const post = deferred<unknown>();
  fetchMock.mockImplementation(async (_path, init) =>
    init?.method === 'POST' ? post.promise : detail,
  );
  const storage = createSupportStorage('user-a');
  const view = render(
    <TicketConversation ticketId="ticket-a" locale="ru" userId="user-a" />,
  );
  await screen.findByLabelText('Ваш ответ');
  fireEvent.change(screen.getByLabelText('Ваш ответ'), {
    target: { value: 'Ответ после перехода' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(1),
  );
  expect(storage.readReplyPending('ticket-a').status).toBe('valid');

  view.unmount();
  await act(async () => post.resolve(null));

  expect(storage.readReplyPending('ticket-a').status).toBe('missing');
  expect(storage.readReplyDraft('ticket-a').status).toBe('missing');
});

it('finalizes the same redacted create marker after an account switch', async () => {
  const post = deferred<unknown>();
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (init?.method === 'POST') return post.promise;
    return [];
  });
  render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));
  await waitFor(() =>
    expect(ownerStorage.readCreatePending().status).toBe('valid'),
  );
  const original = ownerStorage.readCreatePending();
  expect(original.status).toBe('valid');
  if (original.status !== 'valid') throw new Error('pending marker missing');
  expect('unknown' in original.value).toBe(false);

  activateSupportOwner('user-b');
  expect(ownerStorage.readCreatePending()).toEqual({
    status: 'valid',
    value: {
      operationId: original.value.operationId,
      unknown: true,
    },
  });
  await act(async () => post.resolve({ id: 'created' }));

  expect(ownerStorage.readCreatePending().status).toBe('missing');
});

it('preserves a newer create marker and draft after an older success', async () => {
  const post = deferred<unknown>();
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (init?.method === 'POST') return post.promise;
    return [];
  });
  const view = render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));
  await waitFor(() =>
    expect(ownerStorage.readCreatePending().status).toBe('valid'),
  );
  const newerPending = {
    operationId: 'newer-operation',
    draftRevision: 'newer-revision',
    payload: {
      category: 'CONSULTATIONS' as const,
      subject: 'Новая тема',
      body: 'Новый текст',
    },
    baselineIds: [] as string[],
  };
  ownerStorage.saveCreatePending(newerPending);
  ownerStorage.saveCreateDraft({
    revision: newerPending.draftRevision,
    payload: newerPending.payload,
  });

  view.unmount();
  await act(async () => post.resolve({ id: 'created' }));

  expect(ownerStorage.readCreatePending()).toEqual({
    status: 'valid',
    value: newerPending,
  });
  expect(ownerStorage.readCreateDraft()).toEqual({
    status: 'valid',
    value: {
      revision: newerPending.draftRevision,
      payload: newerPending.payload,
    },
  });
});

it('finalizes a definite create rejection after navigation but keeps its draft', async () => {
  const post = deferred<unknown>();
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (init?.method === 'POST') return post.promise;
    return [];
  });
  const view = render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));
  await waitFor(() =>
    expect(ownerStorage.readCreatePending().status).toBe('valid'),
  );
  expect(ownerStorage.readCreateDraft().status).toBe('valid');

  view.unmount();
  await act(async () => post.reject(new ApiError(422, 'VALIDATION')));

  expect(ownerStorage.readCreatePending().status).toBe('missing');
  expect(ownerStorage.readCreateDraft().status).toBe('valid');
});

it('keeps an unresolved create marker after a network failure and navigation', async () => {
  const post = deferred<unknown>();
  fetchMock.mockImplementation(async (path, init) => {
    if (path === 'experts/me') throw new ApiError(404, 'EXPERT_NOT_FOUND');
    if (init?.method === 'POST') return post.promise;
    return [];
  });
  const view = render(<SupportCenter locale="ru" userId="user-a" />);
  await screen.findByLabelText('Тема');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Создать обращение' }));
  await waitFor(() =>
    expect(ownerStorage.readCreatePending().status).toBe('valid'),
  );

  view.unmount();
  await act(async () => post.reject(new TypeError('response lost')));

  expect(ownerStorage.readCreatePending().status).toBe('valid');
  expect(ownerStorage.readCreateDraft().status).toBe('valid');
});

it('finalizes a definite redacted reply rejection after an account switch', async () => {
  const post = deferred<unknown>();
  fetchMock.mockImplementation(async (_path, init) =>
    init?.method === 'POST' ? post.promise : detail,
  );
  const storage = createSupportStorage('user-a');
  render(
    <TicketConversation ticketId="ticket-a" locale="ru" userId="user-a" />,
  );
  await screen.findByLabelText('Ваш ответ');
  fireEvent.change(screen.getByLabelText('Ваш ответ'), {
    target: { value: 'Ответ до смены аккаунта' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));
  await waitFor(() =>
    expect(storage.readReplyPending('ticket-a').status).toBe('valid'),
  );

  activateSupportOwner('user-b');
  const redacted = storage.readReplyPending('ticket-a');
  expect(redacted).toMatchObject({
    status: 'valid',
    value: { unknown: true },
  });
  await act(async () =>
    post.reject(new ApiError(409, 'SUPPORT_SESSION_CHANGED')),
  );

  expect(storage.readReplyPending('ticket-a').status).toBe('missing');
});
