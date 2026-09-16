import { render, screen } from '@testing-library/react';

const getExpert = jest.fn();
const listTopics = jest.fn();
const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

jest.mock('@/lib/api/public', () => ({
  getExpert: (...args: unknown[]) => getExpert(...args),
  listTopics: (...args: unknown[]) => listTopics(...args),
}));
jest.mock('next/navigation', () => ({ notFound: () => notFound() }));
jest.mock('@/components/client/BookingFlow', () => ({
  __esModule: true,
  default: ({
    expert,
    topics,
    locale,
  }: {
    expert: { displayName: string };
    topics: unknown[];
    locale: string;
  }) => (
    <div data-testid="booking" data-topics={topics.length} data-locale={locale}>
      {expert.displayName}
    </div>
  ),
}));

// eslint-disable-next-line import/first
import BookExpertPage from './page';

afterEach(() => jest.clearAllMocks());

describe('BookExpertPage', () => {
  it('открывает запись с реальным публичным профилем и темами', async () => {
    getExpert.mockResolvedValue({ id: 'e1', displayName: 'Айгуль С.' });
    listTopics.mockResolvedValue([
      { id: 't1', slug: 'stress', name: 'Стресс' },
    ]);

    render(
      await BookExpertPage({
        params: Promise.resolve({ locale: 'kz', expertId: 'e1' }),
      }),
    );

    expect(screen.getByTestId('booking')).toHaveTextContent('Айгуль С.');
    expect(screen.getByTestId('booking')).toHaveAttribute('data-topics', '1');
    expect(screen.getByTestId('booking')).toHaveAttribute('data-locale', 'kz');
  });

  it('не показывает запись для исчезнувшего или скрытого специалиста', async () => {
    getExpert.mockResolvedValue(null);
    listTopics.mockResolvedValue([]);

    await expect(
      BookExpertPage({
        params: Promise.resolve({ locale: 'ru', expertId: 'missing' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
