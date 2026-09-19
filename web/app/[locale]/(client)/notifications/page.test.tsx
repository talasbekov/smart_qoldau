import { render, screen } from '@testing-library/react';
import NotificationsPage from './page';

jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: jest.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

it('renders the Kazakh notifications page and empty state', async () => {
  render(
    await NotificationsPage({ params: Promise.resolve({ locale: 'kz' }) }),
  );
  expect(
    screen.getByRole('heading', { name: 'Хабарландырулар' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Сізде әзірге хабарландырулар жоқ'),
  ).toBeInTheDocument();
});
