import { render, screen } from '@testing-library/react';
import LoginPage from './page';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

it('renders the entire Kazakh login page in its selected language', async () => {
  render(
    await LoginPage({
      params: Promise.resolve({ locale: 'kz' }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(
    screen.getByRole('heading', { name: 'SmartQoldau жүйесіне кіру' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Кодты SMS арқылы жібереміз — құпиясөз қажет емес'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Телефон нөмірі')).toBeInTheDocument();
});
