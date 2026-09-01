import { render, screen } from '@testing-library/react';
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
  it('показывает код клиента и НИКОГДА не имя', () => {
    render(<ExpertConsultationList items={[item()] as never} topics={[]} locale="ru" />);

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

    expect(screen.getByRole('heading', { name: /Предстоящие/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Прошедшие/ })).toBeInTheDocument();
  });

  it('показывает заработок, а не цену для клиента', () => {
    render(<ExpertConsultationList items={[item()] as never} topics={[]} locale="ru" />);

    // Эксперту важно, сколько он получит; комиссия платформы — 15 %.
    expect(screen.getByText(/3 392 ₸/)).toBeInTheDocument();
  });

  it('пусто — так и говорит', () => {
    render(<ExpertConsultationList items={[]} topics={[]} locale="ru" />);

    expect(screen.getByText(/консультаций пока нет/i)).toBeInTheDocument();
  });
});
