import { render, screen } from '@testing-library/react';
import DashboardStats, { todayStats } from './DashboardStats';

const consultation = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  status: 'SCHEDULED',
  outcome: null,
  format: 'video',
  isEmergency: false,
  startedAt: '2026-09-02T09:00:00.000Z',
  endedAt: null,
  clientCode: 1234,
  topicSlug: 'burnout',
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: 'CAPTURED',
  ...over,
});

const NOW = new Date('2026-09-02T12:00:00.000Z');

describe('todayStats', () => {
  it('считает только сегодняшние консультации', () => {
    const stats = todayStats(
      [consultation(), consultation({ id: 'c2', startedAt: '2026-08-30T09:00:00.000Z' })] as never,
      NOW,
    );

    expect(stats.total).toBe(1);
  });

  it('завершённые считает отдельно', () => {
    const stats = todayStats(
      [consultation({ status: 'COMPLETED' }), consultation({ id: 'c2' })] as never,
      NOW,
    );

    expect(stats).toMatchObject({ total: 2, completed: 1 });
  });

  it('отменённые не идут в «завершено»', () => {
    const stats = todayStats([consultation({ status: 'CANCELLED' })] as never, NOW);

    expect(stats.completed).toBe(0);
  });

  it('пустой день — это ноль, а не поломка', () => {
    expect(todayStats([] as never, NOW)).toEqual({ total: 0, completed: 0 });
  });
});

describe('DashboardStats', () => {
  it('приветствует по имени', () => {
    render(<DashboardStats name="Айгуль" stats={{ total: 4, completed: 3 }} balanceTiyn={1197000} rating={4.9} reviews={312} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Здравствуйте, Айгуль');
  });

  it('здоровается по имени, а не по имени с фамилией', () => {
    render(
      <DashboardStats
        name="Айгуль Смагулова"
        stats={{ total: 1, completed: 0 }}
        balanceTiyn={0}
        rating={0}
        reviews={0}
      />,
    );

    // «Здравствуйте, Айгуль Смагулова» звучит как обращение из банка.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Здравствуйте, Айгуль');
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Смагулова');
  });

  it('пустой день говорит об этом словами, а не показывает четыре нуля', () => {
    render(<DashboardStats name="Айгуль" stats={{ total: 0, completed: 0 }} balanceTiyn={0} rating={0} reviews={0} />);

    expect(screen.getByText(/сегодня консультаций нет/i)).toBeInTheDocument();
  });

  it('показывает доход в тенге, а не в тиынах', () => {
    render(<DashboardStats name="Айгуль" stats={{ total: 4, completed: 3 }} balanceTiyn={1197000} rating={4.9} reviews={312} />);

    expect(screen.getByText('11 970 ₸')).toBeInTheDocument();
  });

  it('не показывает рейтинг, пока отзывов нет: 0.0 звёзд — это неправда', () => {
    render(<DashboardStats name="Айгуль" stats={{ total: 1, completed: 0 }} balanceTiyn={0} rating={0} reviews={0} />);

    expect(screen.queryByText(/0[.,]0/)).toBeNull();
  });
});
