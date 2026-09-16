import { render, screen } from '@testing-library/react';

const authorizedFetch = jest.fn();
const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));
jest.mock('next/navigation', () => ({ notFound: () => notFound() }));
jest.mock('@/components/client/BookingFlow', () => ({
  __esModule: true,
  default: ({
    consultation,
    locale,
  }: {
    consultation?: { id: string };
    locale: string;
  }) => (
    <div
      data-testid="reschedule"
      data-id={consultation?.id}
      data-locale={locale}
    />
  ),
}));

// eslint-disable-next-line import/first
import ReschedulePage from './page';

const CONSULTATION = {
  id: 'c1',
  status: 'SCHEDULED',
  expert: { id: 'e1', displayName: 'Айгуль С.' },
};

afterEach(() => jest.clearAllMocks());

describe('ReschedulePage', () => {
  it('открывает перенос только для своей запланированной консультации', async () => {
    authorizedFetch.mockResolvedValue(CONSULTATION);

    render(
      await ReschedulePage({
        params: Promise.resolve({ locale: 'ru', id: 'c1' }),
      }),
    );

    expect(screen.getByTestId('reschedule')).toHaveAttribute('data-id', 'c1');
    expect(screen.getByTestId('reschedule')).toHaveAttribute(
      'data-locale',
      'ru',
    );
  });

  it('не открывает перенос для активной консультации', async () => {
    authorizedFetch.mockResolvedValue({ ...CONSULTATION, status: 'ACTIVE' });

    await expect(
      ReschedulePage({
        params: Promise.resolve({ locale: 'ru', id: 'c1' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
