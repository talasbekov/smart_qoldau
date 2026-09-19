import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

const apiFetch = jest.fn();
const refresh = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

// eslint-disable-next-line import/first
import ConsultationStatusRefresh from './ConsultationStatusRefresh';

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

it('refreshes the scheduled page when the API reports that the session is active', async () => {
  const status = jest.fn();
  window.addEventListener('sq:expert-work-status', status);
  apiFetch.mockResolvedValue({ status: 'ACTIVE' });
  render(
    <ConsultationStatusRefresh
      consultationId="c1"
      initialStatus="SCHEDULED"
      locale="ru"
    />,
  );

  await act(async () => jest.advanceTimersByTime(15_000));

  expect(apiFetch).toHaveBeenCalledWith('consultations/c1');
  expect(status).toHaveBeenCalledWith(
    expect.objectContaining({ detail: 'BUSY' }),
  );
  expect(refresh).toHaveBeenCalledTimes(1);
  window.removeEventListener('sq:expert-work-status', status);
});

it('shows a recoverable error and retries without a second mutation', async () => {
  apiFetch
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ status: 'ACTIVE' });
  render(
    <ConsultationStatusRefresh
      consultationId="c1"
      initialStatus="SCHEDULED"
      locale="ru"
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Проверить статус' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось/i);

  fireEvent.click(screen.getByRole('button', { name: 'Проверить статус' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
});

const handlers = new Map<string, (payload: unknown) => void>();
let ready: (() => void) | undefined;
const close = jest.fn();
jest.mock('@/lib/realtime/socket', () => ({
  connectRealtime: async () => ({
    on: (event: string, handler: (payload: unknown) => void) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    },
    onReady: (handler: () => void) => {
      ready = handler;
      return () => {
        ready = undefined;
      };
    },
    close: () => close(),
  }),
}));
beforeEach(() => {
  handlers.clear();
  ready = undefined;
});

it('refreshes an active consultation after its completion event is confirmed by REST', async () => {
  apiFetch.mockResolvedValue({ status: 'COMPLETED' });
  render(
    <ConsultationStatusRefresh
      consultationId="c1"
      initialStatus="ACTIVE"
      locale="ru"
    />,
  );
  await act(async () => {});
  await act(async () =>
    handlers.get('consultation.updated')?.({
      id: 'other',
      status: 'COMPLETED',
    }),
  );
  expect(apiFetch).not.toHaveBeenCalled();
  await act(async () =>
    handlers.get('consultation.updated')?.({ id: 'c1', status: 'COMPLETED' }),
  );
  expect(apiFetch).toHaveBeenCalledWith('consultations/c1');
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('reconciles active state after socket readiness/reconnect and closes its socket on unmount', async () => {
  apiFetch
    .mockResolvedValueOnce({ status: 'ACTIVE' })
    .mockResolvedValueOnce({ status: 'COMPLETED' });
  const view = render(
    <ConsultationStatusRefresh
      consultationId="c1"
      initialStatus="ACTIVE"
      locale="ru"
    />,
  );
  await act(async () => {});
  await act(async () => ready?.());
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => ready?.());
  expect(refresh).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(close).toHaveBeenCalledTimes(1);
});

it('polls active consultations when the completion socket event is missed', async () => {
  apiFetch.mockResolvedValue({ status: 'COMPLETED' });
  render(
    <ConsultationStatusRefresh
      consultationId="c1"
      initialStatus="ACTIVE"
      locale="ru"
    />,
  );
  await act(async () => jest.advanceTimersByTime(15_000));
  expect(refresh).toHaveBeenCalledTimes(1);
});
