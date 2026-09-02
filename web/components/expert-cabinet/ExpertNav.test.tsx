import { render, screen } from '@testing-library/react';

let pathname = '/ru/expert';
jest.mock('next/navigation', () => ({ usePathname: () => pathname }));
jest.mock('@/lib/i18n/navigation', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

// eslint-disable-next-line import/first
import ExpertNav from './ExpertNav';

describe('ExpertNav', () => {
  it('ведёт во все разделы, которые есть в продукте', () => {
    render(<ExpertNav />);

    for (const name of ['Главная', 'Заявки', 'Консультации', 'Клиенты', 'Расписание', 'Доход', 'Рейтинг']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('не показывает «Чаты» отдельным пунктом', () => {
    render(<ExpertNav />);

    // Переписка живёт внутри консультации, отдельный раздел её дублирует.
    expect(screen.queryByRole('link', { name: 'Чаты' })).toBeNull();
  });

  it('помечает текущий раздел', () => {
    pathname = '/ru/expert/offers';
    render(<ExpertNav />);

    expect(screen.getByRole('link', { name: 'Заявки' })).toHaveAttribute('aria-current', 'page');
  });

  it('главная активна только на самой главной', () => {
    pathname = '/ru/expert/offers';
    render(<ExpertNav />);

    expect(screen.getByRole('link', { name: 'Главная' })).not.toHaveAttribute('aria-current');
  });
});
