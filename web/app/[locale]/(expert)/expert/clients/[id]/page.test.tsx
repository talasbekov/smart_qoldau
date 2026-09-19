import { render, screen } from '@testing-library/react';
import ClientPage from './page';

const listTopics = jest.fn();
jest.mock('@/lib/api/public', () => ({
  listTopics: (...args: unknown[]) => listTopics(...args),
}));
jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: jest.fn().mockResolvedValue({
    id: 'c1',
    displayName: 'Айгерим',
    consultations: 1,
    history: [
      {
        id: 's1',
        topicSlug: 'stress',
        startedAt: '2026-09-01T21:00:00.000Z',
        status: 'COMPLETED',
        hasNote: true,
      },
    ],
  }),
}));

it('uses Kazakh topic names, statuses and Almaty time for client history', async () => {
  listTopics.mockImplementation(async (locale) => [
    { slug: 'stress', name: locale === 'kz' ? 'Күйзеліс' : 'Стресс' },
  ]);
  render(
    await ClientPage({ params: Promise.resolve({ locale: 'kz', id: 'c1' }) }),
  );
  expect(screen.getByText('Күйзеліс')).toBeInTheDocument();
  expect(screen.getByText(/2 қыркүйек, 02:00/)).toHaveTextContent('Аяқталды');
  expect(
    screen.getByRole('link', { name: 'Кездесу мен жазбаны ашу' }),
  ).toHaveAttribute('href', '/kz/expert/consultations/s1');
});
