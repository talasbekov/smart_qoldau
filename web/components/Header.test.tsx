import { render, screen } from '@testing-library/react';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

let current: typeof ru = ru;

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (current as Record<string, Record<string, unknown>>)[namespace] ?? {};
    return (key: string) => typeof dict[key] === 'string' ? dict[key] : `${namespace}.${key}`;
  },
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/ru/catalog',
  useSearchParams: () => new URLSearchParams('format=video'),
}));
jest.mock('@/lib/i18n/navigation', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

// eslint-disable-next-line import/first
import Header from './Header';

async function renderHeader(messages: typeof ru) {
  current = messages;
  render(await Header());
}

describe('Header', () => {
  it('provides the login entry from the prototype', async () => {
    await renderHeader(ru);
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
  });

  it('lets the reader change language without losing the current filter', async () => {
    await renderHeader(ru);
    expect(screen.getByRole('link', { name: 'Қазақша' })).toHaveAttribute(
      'href', '/kz/catalog?format=video',
    );
  });
  it('allows the navigation to wrap on a narrow viewport instead of widening the page', async () => {
    const { container } = render(await Header());

    expect(container.querySelector('nav')).toHaveClass('flex-wrap');
    expect(container.querySelector('header > div')).toHaveClass('flex-wrap');
  });

  it('ведёт в каталог — главный вход в продукт из шапки', async () => {
    await renderHeader(ru);

    expect(screen.getByRole('link', { name: 'Каталог' })).toHaveAttribute('href', '/catalog');
  });

  it('помечает текущий раздел', async () => {
    await renderHeader(ru);

    expect(screen.getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['ru', ru],
    ['kz', kz],
  ])('в локали %s не печатает сырые ключи', async (_name, messages) => {
    await renderHeader(messages as typeof ru);

    expect(screen.queryByText(/^nav\./)).toBeNull();
  });
});
