import { render, screen } from '@testing-library/react';
import ConsultationList from './ConsultationList';

const EXPERT = {
  id: 'e1',
  displayName: 'Айгуль С.',
  city: 'Алматы',
  experience: 'THREE_TO_FIVE',
  priceTiyn: 399000,
  languages: ['ru'],
  formats: ['chat'],
  topicSlugs: [],
  workStatus: 'ACCEPTING',
  ratingAvg: 0,
  ratingCount: 0,
  photoUrl: null,
  about: null,
};

function consultation(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    status: 'SCHEDULED',
    outcome: null,
    format: 'video',
    isEmergency: false,
    startedAt: '2026-09-10T10:00:00.000Z',
    endedAt: null,
    priceTiyn: 399000,
    plannedDurationMin: 50,
    paymentStatus: 'UNPAID',
    expert: EXPERT,
    reviewId: null,
    ...over,
  } as never;
}

describe('ConsultationList', () => {
  it('пустой список объясняется словами и зовёт завести заявку', () => {
    render(<ConsultationList items={[]} locale="ru" />);

    expect(screen.getByText(/пока нет консультаций/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Найти специалиста/ }),
    ).toHaveAttribute('href', '/ru/requests/new');
  });

  it('делит на предстоящие и прошедшие', () => {
    render(
      <ConsultationList
        items={[
          consultation(),
          consultation({ id: 'c2', status: 'COMPLETED' }),
        ]}
        locale="ru"
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Предстоящие/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Прошедшие/ }),
    ).toBeInTheDocument();
  });

  it('у прошедшей без отзыва зовёт оценить', () => {
    render(
      <ConsultationList
        items={[consultation({ status: 'COMPLETED', reviewId: null })]}
        locale="ru"
      />,
    );

    expect(screen.getByRole('link', { name: /Оценить/ })).toBeInTheDocument();
  });

  it('у оценённой не зовёт оценить второй раз', () => {
    render(
      <ConsultationList
        items={[consultation({ status: 'COMPLETED', reviewId: 'rev1' })]}
        locale="ru"
      />,
    );

    expect(screen.queryByRole('link', { name: /Оценить/ })).toBeNull();
  });

  it('отменённая помечена и не предлагает оплату', () => {
    render(
      <ConsultationList
        items={[consultation({ status: 'CANCELLED', paymentStatus: 'UNPAID' })]}
        locale="ru"
      />,
    );

    expect(screen.getByText(/Отменена/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Оплатить/ })).toBeNull();
  });

  it('неоплаченная предстоящая зовёт оплатить', () => {
    render(
      <ConsultationList
        items={[consultation({ paymentStatus: 'UNPAID' })]}
        locale="ru"
      />,
    );

    expect(screen.getByRole('link', { name: /Оплатить/ })).toHaveAttribute(
      'href',
      '/ru/consultations/c1/payment',
    );
  });

  it('ссылка на оплату локализована для казахского маршрута', () => {
    render(
      <ConsultationList
        items={[consultation({ paymentStatus: 'UNPAID' })]}
        locale="kz"
      />,
    );

    expect(screen.getByRole('link', { name: 'Төлеу' })).toHaveAttribute(
      'href',
      '/kz/consultations/c1/payment',
    );
  });

  it('после отказа оплаты оставляет путь к повторной попытке', () => {
    render(
      <ConsultationList
        items={[consultation({ paymentStatus: 'FAILED' })]}
        locale="ru"
      />,
    );

    expect(
      screen.getByRole('link', { name: /Повторить оплату/ }),
    ).toHaveAttribute('href', '/ru/consultations/c1/payment');
  });

  it('срочная помечена: это другой сценарий и другая цена времени', () => {
    render(
      <ConsultationList
        items={[consultation({ isEmergency: true })]}
        locale="ru"
      />,
    );

    expect(screen.getByText(/Срочная/)).toBeInTheDocument();
  });
});
