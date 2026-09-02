import { render, screen } from '@testing-library/react';

let pathname = '/ru';
jest.mock('next/navigation', () => ({ usePathname: () => pathname }));
jest.mock('@/lib/i18n/navigation', () => ({
  // Пробрасываем все атрибуты: настоящий Link из next-intl делает так же,
  // и мок, который их глотает, проверял бы не то поведение.
  Link: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

// eslint-disable-next-line import/first
import NavLink from './NavLink';

describe('NavLink', () => {
  it('помечает текущий раздел для скринридера', () => {
    pathname = '/ru/about';
    render(<NavLink href="/about">О нас</NavLink>);

    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
  });

  it('не помечает чужой раздел', () => {
    pathname = '/ru/about';
    render(<NavLink href="/premium">Premium</NavLink>);

    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
  });

  it('главная активна только на главной, а не на каждой странице', () => {
    pathname = '/ru/about';
    render(<NavLink href="/">Главная</NavLink>);

    // Наивная проверка «путь начинается с href» пометила бы главную всегда.
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
  });

  it('на самой главной помечает её', () => {
    pathname = '/kz';
    render(<NavLink href="/">Главная</NavLink>);

    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
  });

  it('вложенная страница раздела считается тем же разделом', () => {
    pathname = '/ru/experts/e1';
    render(<NavLink href="/catalog">Каталог</NavLink>);

    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
  });
});
