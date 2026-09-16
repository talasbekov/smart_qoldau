import { render, screen } from '@testing-library/react';

let pathname = '/ru/consultations';
jest.mock('next/navigation', () => ({ usePathname: () => pathname }));
jest.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

// eslint-disable-next-line import/first
import CabinetNav from './CabinetNav';

describe('CabinetNav', () => {
  beforeEach(() => {
    pathname = '/ru/consultations';
  });

  it('объявлен навигацией с понятным именем', () => {
    render(<CabinetNav />);

    expect(
      screen.getByRole('navigation', { name: /кабинет/i }),
    ).toBeInTheDocument();
  });

  it('ведёт во все разделы кабинета', () => {
    render(<CabinetNav />);

    for (const name of [
      'Консультации',
      'Избранное',
      'Уведомления',
      'Профиль',
      'Поддержка',
    ]) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('помечает текущий раздел', () => {
    pathname = '/ru/consultations';
    render(<CabinetNav />);

    expect(screen.getByRole('link', { name: 'Консультации' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('вложенная страница раздела тоже считается текущим разделом', () => {
    // Карточка консультации — часть раздела; без этого на ней подсветка
    // пропадает и человек теряет, где он.
    pathname = '/ru/consultations/c1';
    render(<CabinetNav />);

    expect(screen.getByRole('link', { name: 'Консультации' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('не помечает соседний раздел', () => {
    pathname = '/ru/consultations/c1';
    render(<CabinetNav />);

    expect(screen.getByRole('link', { name: 'Профиль' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('в казахской локали переводит навигацию кабинета', () => {
    pathname = '/kz/consultations';
    render(<CabinetNav />);

    expect(
      screen.getByRole('navigation', { name: 'Кабинет бөлімдері' }),
    ).toBeInTheDocument();
    for (const name of [
      'Кеңестер',
      'Таңдаулылар',
      'Хабарландырулар',
      'Профиль',
      'Қолдау',
    ]) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });
});
