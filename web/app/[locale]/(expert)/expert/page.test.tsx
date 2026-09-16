import { render, screen } from '@testing-library/react';

const authorizedFetch = jest.fn();
jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));
jest.mock('@/components/expert-cabinet/DashboardStats', () => ({
  __esModule: true,
  todayStats: () => ({ total: 0, completed: 0 }),
  default: () => <div data-testid="dashboard" />,
}));

// eslint-disable-next-line import/first
import ExpertHomePage from './page';

afterEach(() => jest.clearAllMocks());

it('loads consultations explicitly as the expert, not the default client side', async () => {
  authorizedFetch
    .mockResolvedValueOnce({ displayName: 'Айгуль' })
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce({ availableTiyn: 0 })
    .mockResolvedValueOnce({ ratingAvg: 0, ratingCount: 0 });

  render(await ExpertHomePage({ params: Promise.resolve({ locale: 'ru' }) }));

  expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  expect(authorizedFetch).toHaveBeenCalledWith('consultations?as=expert');
});
