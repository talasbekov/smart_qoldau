import { render, screen } from '@testing-library/react';

const requireUser = jest.fn();
jest.mock('@/lib/auth/require-user', () => ({
  requireUser: (...args: unknown[]) => requireUser(...args),
}));
jest.mock('@/components/support/SupportCenter', () => ({
  __esModule: true,
  default: ({ locale }: { locale: string }) => <div>center-{locale}</div>,
}));

// eslint-disable-next-line import/first
import SupportRequestsPage from './page';

it('requires a session before rendering the localized support center', async () => {
  requireUser.mockResolvedValue({ id: 'user-1' });

  render(
    await SupportRequestsPage({ params: Promise.resolve({ locale: 'kz' }) }),
  );

  expect(requireUser).toHaveBeenCalledWith('kz');
  expect(screen.getByText('center-kz')).toBeInTheDocument();
});
