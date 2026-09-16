import { render, screen } from '@testing-library/react';

const authorizedFetch = jest.fn();
const listTopics = jest.fn();
jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));
jest.mock('@/lib/api/public', () => ({
  listTopics: (...args: unknown[]) => listTopics(...args),
}));
jest.mock('@/components/expert-cabinet/ExpertConsultationList', () => ({
  __esModule: true,
  default: () => <div data-testid="consultations" />,
}));

// eslint-disable-next-line import/first
import ExpertConsultationsPage from './page';

afterEach(() => jest.clearAllMocks());

it('loads the expert view required by ConsultationExpertDto', async () => {
  authorizedFetch.mockResolvedValue([]);
  listTopics.mockResolvedValue([]);

  render(
    await ExpertConsultationsPage({
      params: Promise.resolve({ locale: 'ru' }),
    }),
  );

  expect(screen.getByTestId('consultations')).toBeInTheDocument();
  expect(authorizedFetch).toHaveBeenCalledWith('consultations?as=expert');
  expect(listTopics).toHaveBeenCalledWith('ru');
});
