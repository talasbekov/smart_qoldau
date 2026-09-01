import { render, screen, waitFor, act } from '@testing-library/react';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// Сокет подменяется целиком: тест проверяет реакцию экрана на событие,
// а не транспорт — у него свои тесты.
const handlers: Record<string, (payload: unknown) => void> = {};
const close = jest.fn();
jest.mock('@/lib/realtime/socket', () => ({
  connectRealtime: async () => ({
    on: (event: string, handler: (payload: unknown) => void) => {
      handlers[event] = handler;
      return () => delete handlers[event];
    },
    onReady: () => () => {},
    send: () => {},
    close,
  }),
}));

// eslint-disable-next-line import/first
import RequestStatus from './RequestStatus';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
  jest.useRealTimers();
});

function respond(sequence: unknown[]) {
  const fn = jest.fn();
  for (const payload of sequence) {
    fn.mockResolvedValueOnce({ ok: true, status: 200, json: async () => payload });
  }
  fn.mockResolvedValue({ ok: true, status: 200, json: async () => sequence[sequence.length - 1] });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('RequestStatus', () => {
  it('пока идёт подбор, говорит об этом, а не показывает пустоту', async () => {
    respond([{ id: 'r1', status: 'SEARCHING' }]);
    render(<RequestStatus requestId="r1" initial={{ id: 'r1', status: 'SEARCHING' }} locale="ru" />);

    expect(screen.getByText(/Ищем свободного специалиста/i)).toBeInTheDocument();
  });

  it('когда специалист найден, ведёт к консультации по событию сокета', async () => {
    render(<RequestStatus requestId="r1" initial={{ id: 'r1', status: 'SEARCHING' }} locale="ru" />);
    await waitFor(() => expect(handlers['request.updated']).toBeDefined());

    await act(async () => {
      handlers['request.updated']({ id: 'r1', status: 'MATCHED', consultationId: 'c1' });
    });

    await waitFor(() => expect(push).toHaveBeenCalledWith('/ru/consultations/c1'));
  });

  it('не реагирует на событие о чужой заявке', async () => {
    render(<RequestStatus requestId="r1" initial={{ id: 'r1', status: 'SEARCHING' }} locale="ru" />);
    await waitFor(() => expect(handlers['request.updated']).toBeDefined());

    await act(async () => {
      handlers['request.updated']({ id: 'other', status: 'MATCHED', consultationId: 'c9' });
    });

    expect(push).not.toHaveBeenCalled();
  });

  it('закрывает сокет, когда экран уходит', async () => {
    const { unmount } = render(
      <RequestStatus requestId="r1" initial={{ id: 'r1', status: 'SEARCHING' }} locale="ru" />,
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
    expect(screen.getByRole('link', { name: /150/ })).toHaveAttribute('href', 'tel:150');
  });

  it('отменённая заявка не изображает поиск', () => {
    render(<RequestStatus requestId="r1" initial={{ id: 'r1', status: 'CANCELLED' }} locale="ru" />);

    expect(screen.queryByText(/Ищем свободного/i)).toBeNull();
    expect(screen.getByText(/отменена/i)).toBeInTheDocument();
  });
});
