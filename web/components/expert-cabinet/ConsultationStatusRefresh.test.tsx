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
