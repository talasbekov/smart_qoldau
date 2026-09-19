import { render, screen } from '@testing-library/react';
import FavoritesPage from './page';

jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: jest.fn().mockResolvedValue([]),
}));

it('renders Kazakh favorites with a link to the Kazakh catalog', async () => {
  render(await FavoritesPage({ params: Promise.resolve({ locale: 'kz' }) }));
  expect(
    screen.getByRole('heading', { name: 'Таңдаулылар' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Мұнда сіз сақтаған мамандар пайда болады'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Каталогты ашу' })).toHaveAttribute(
    'href',
    '/kz/catalog',
  );
});
