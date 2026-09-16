import { render, screen } from '@testing-library/react';

const authorizedFetch = jest.fn();
jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));
jest.mock('next/navigation', () => ({ notFound: jest.fn() }));
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
