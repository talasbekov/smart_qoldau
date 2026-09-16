import { render, screen } from '@testing-library/react';

const authorizedFetch = jest.fn();
const listTopics = jest.fn();
jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));
jest.mock('@/lib/api/public', () => ({
  listTopics: (...args: unknown[]) => listTopics(...args),
}));
jest.mock('@/components/expert-cabinet/OfferList', () => ({
  __esModule: true,
  default: () => <div data-testid="offers" />,
}));

// eslint-disable-next-line import/first
import OffersPage from './page';

afterEach(() => jest.clearAllMocks());

it('loads topic labels in the current cabinet locale', async () => {
  authorizedFetch.mockResolvedValue([]);
  listTopics.mockResolvedValue([]);

  render(
    await OffersPage({
      params: Promise.resolve({ locale: 'kz' }),
    }),
  );

  expect(screen.getByTestId('offers')).toBeInTheDocument();
  expect(listTopics).toHaveBeenCalledWith('kz');
});
