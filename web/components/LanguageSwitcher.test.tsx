import { render, screen } from '@testing-library/react';
import LanguageSwitcher from './LanguageSwitcher';

let pathname = '/ru/login';
let query = 'returnTo=%2Fru%2Frequests%2Fnew';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(query),
}));

it('keeps the supported consultation continuation when switching login language', () => {
  render(<LanguageSwitcher />);
  const link = screen.getByRole('link', { name: 'Қазақша' });
  const url = new URL(link.getAttribute('href')!, 'https://local.test');
  expect(url.pathname).toBe('/kz/login');
  expect(url.searchParams.get('returnTo')).toBe('/kz/requests/new');
});

it('switches Kazakh back to Russian while preserving ordinary filters', () => {
  pathname = '/kz/catalog';
  query = 'format=video';
  render(<LanguageSwitcher />);
  expect(screen.getByRole('link', { name: 'Русский' })).toHaveAttribute('href', '/ru/catalog?format=video');
});
