import { render, screen } from '@testing-library/react';

jest.mock('./Session', () => ({
  __esModule: true,
  default: () => <div data-testid="session">session</div>,
}));
jest.mock('./Chat', () => ({
  __esModule: true,
  default: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="chat" data-read-only={readOnly ? 'true' : 'false'}>
      chat
    </div>
  ),
}));

// eslint-disable-next-line import/first
import ConsultationAccess from './ConsultationAccess';

function consultation(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    status: 'ACTIVE',
    outcome: null,
    format: 'video',
    isEmergency: false,
    startedAt: '2026-09-16T10:00:00.000Z',
    endedAt: null,
    priceTiyn: 399000,
    plannedDurationMin: 50,
    paymentStatus: 'UNPAID',
    expert: {
      id: 'e1',
      displayName: 'Айгуль С.',
      city: 'Алматы',
      experience: 'THREE_TO_FIVE',
      priceTiyn: 399000,
      languages: ['ru'],
      formats: ['video'],
      topicSlugs: [],
      workStatus: 'ACCEPTING',
      ratingAvg: 4.9,
      ratingCount: 12,
      photoUrl: null,
      about: null,
    },
    reviewId: null,
    ...over,
  } as never;
}

describe('ConsultationAccess', () => {
  it('для UNPAID ведёт в checkout и не монтирует live-компоненты', () => {
    render(<ConsultationAccess consultation={consultation()} locale="ru" />);

    expect(
      screen.getByRole('link', { name: 'Оплатить консультацию' }),
    ).toHaveAttribute('href', '/ru/consultations/c1/payment');
    expect(screen.queryByTestId('session')).toBeNull();
    expect(screen.queryByTestId('chat')).toBeNull();
  });

  it('ACTIVE chat с FAILED сохраняет историю только для чтения рядом с оплатой', () => {
    render(
      <ConsultationAccess
        consultation={consultation({
          format: 'chat',
          paymentStatus: 'FAILED',
        })}
        locale="ru"
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Оплатить консультацию' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('chat')).toHaveAttribute(
      'data-read-only',
      'true',
    );
    expect(screen.queryByTestId('session')).toBeNull();
  });

  it('ACTIVE с подтверждённым HELD открывает сессию', () => {
    render(
      <ConsultationAccess
        consultation={consultation({ paymentStatus: 'HELD' })}
        locale="ru"
      />,
    );

    expect(screen.getByTestId('session')).toBeInTheDocument();
  });

  it('CAPTURED не открывает live-сессию', () => {
    render(
      <ConsultationAccess
        consultation={consultation({ paymentStatus: 'CAPTURED' })}
        locale="ru"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      /без подтверждённого холда/i,
    );
    expect(screen.queryByTestId('session')).toBeNull();
    expect(screen.queryByTestId('chat')).toBeNull();
  });

  it('SCHEDULED с HELD подтверждает оплату, но не запускает сессию раньше времени', () => {
    render(
      <ConsultationAccess
        consultation={consultation({
          status: 'SCHEDULED',
          paymentStatus: 'HELD',
        })}
        locale="ru"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      /холд подтверждён.*начала консультации/i,
    );
    expect(screen.queryByTestId('session')).toBeNull();
  });

  it('казахская CTA ведёт в локализованный checkout', () => {
    render(<ConsultationAccess consultation={consultation()} locale="kz" />);

    expect(
      screen.getByRole('link', { name: 'Кеңес ақысын төлеу' }),
    ).toHaveAttribute('href', '/kz/consultations/c1/payment');
  });
});
