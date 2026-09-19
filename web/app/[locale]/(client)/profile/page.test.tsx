import { render, screen } from '@testing-library/react';
import ProfilePage from './page';

jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: jest.fn().mockResolvedValue(null),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));

it('uses Kazakh for the profile heading and account controls', async () => {
  render(await ProfilePage({ params: Promise.resolve({ locale: 'kz' }) }));
  expect(screen.getByRole('heading', { name: 'Профиль' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Шығу' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Аккаунтты жою' }),
  ).toBeInTheDocument();
});
