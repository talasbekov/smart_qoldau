import { act, render, screen } from '@testing-library/react';

const authorizedFetch = jest.fn();
const apiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));
jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));
const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  notFound: jest.fn(),
  useRouter: () => ({ refresh }),
}));
jest.mock('@/lib/realtime/socket', () => ({
  connectRealtime: async () => ({
    on: () => () => {},
    onReady: () => () => {},
    close: jest.fn(),
  }),
}));
jest.mock('@/components/client/ConsultationAccess', () => ({
  __esModule: true,
  default: () => <div>access</div>,
}));

// eslint-disable-next-line import/first
import ConsultationPage from './page';

const CONSULTATION = {
  id: 'c1',
  status: 'SCHEDULED',
  outcome: null,
  format: 'video',
  isEmergency: false,
  startedAt: '2026-09-17T04:00:00.000Z',
  endedAt: null,
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: 'HELD',
  expert: { displayName: 'Айгуль С.' },
  reviewId: null,
};

afterEach(() => jest.clearAllMocks());

describe('ConsultationPage', () => {
  it('подтверждает время консультации по Алматы, а не в зоне браузера', async () => {
    authorizedFetch.mockResolvedValue(CONSULTATION);

    render(
      await ConsultationPage({
        params: Promise.resolve({ locale: 'ru', id: 'c1' }),
      }),
    );

    expect(screen.getByText(/17 сентября 2026.*09:00/)).toBeInTheDocument();
    expect(screen.getByText(/Asia\/Almaty/)).toBeInTheDocument();
  });

  it('локализует подтверждение времени для казахского маршрута', async () => {
    authorizedFetch.mockResolvedValue(CONSULTATION);

    render(
      await ConsultationPage({
        params: Promise.resolve({ locale: 'kz', id: 'c1' }),
      }),
    );

    expect(screen.getByText(/09:00/)).toBeInTheDocument();
    expect(screen.getByText(/Алматы уақыты.*Asia\/Almaty/)).toBeInTheDocument();
  });
});

it('refreshes the client detail after completion even if the websocket event is lost', async () => {
  jest.useFakeTimers();
  authorizedFetch.mockResolvedValue({ ...CONSULTATION, status: 'ACTIVE' });
  apiFetch.mockResolvedValue({ status: 'COMPLETED' });
  const view = render(
    await ConsultationPage({
      params: Promise.resolve({ locale: 'ru', id: 'c1' }),
    }),
  );
  try {
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(apiFetch).toHaveBeenCalledWith('consultations/c1');
    expect(refresh).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    jest.useRealTimers();
  }
});
