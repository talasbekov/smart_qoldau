import { act, render, screen } from '@testing-library/react';

const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
import ExpertConsultationList from './ExpertConsultationList';

const item = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  status: 'SCHEDULED',
  outcome: null,
  format: 'video',
  isEmergency: false,
  startedAt: '2026-09-02T09:00:00.000Z',
  endedAt: null,
  clientCode: 4831,
  topicSlug: 'burnout',
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: 'CAPTURED',
  ...over,
});

describe('ExpertConsultationList', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('показывает код клиента и НИКОГДА не имя', () => {
    render(
      <ExpertConsultationList
        items={[item()] as never}
        topics={[]}
        locale="ru"
      />,
    );

    expect(screen.getByText(/№4831/)).toBeInTheDocument();
  });

  it('делит на предстоящие и прошедшие', () => {
    render(
      <ExpertConsultationList
        items={[item(), item({ id: 'c2', status: 'COMPLETED' })] as never}
        topics={[]}
        locale="ru"
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Запланированные/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Прошедшие/ }),
    ).toBeInTheDocument();
  });

  it('показывает заработок, а не цену для клиента', () => {
    render(
      <ExpertConsultationList
        items={[item()] as never}
        topics={[]}
        locale="ru"
      />,
    );

    // Эксперту важно, сколько он получит; комиссия платформы — 15 %.
    expect(screen.getByText(/3 392 ₸/)).toBeInTheDocument();
  });

  it('пусто — так и говорит', () => {
    render(<ExpertConsultationList items={[]} topics={[]} locale="ru" />);

    expect(screen.getByText(/консультаций пока нет/i)).toBeInTheDocument();
  });

  it('выделяет активную сессию отдельным действием', () => {
    render(
      <ExpertConsultationList
        items={[item({ status: 'ACTIVE' })] as never}
        topics={[]}
        locale="ru"
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Идёт сейчас' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Открыть сессию' }),
    ).toBeInTheDocument();
  });

  it('обновляет server status плановой консультации, пока список открыт', () => {
    jest.useFakeTimers();
    render(
      <ExpertConsultationList
        items={[item()] as never}
        topics={[]}
        locale="ru"
      />,
    );

    act(() => jest.advanceTimersByTime(30_000));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('локализует текущие консультации для казахского кабинета', () => {
    render(
      <ExpertConsultationList
        items={[item({ status: 'ACTIVE' })] as never}
        topics={[]}
        locale="kz"
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Қазір өтіп жатыр' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Сессияны ашу' }),
    ).toBeInTheDocument();
  });
});
