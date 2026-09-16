import { render, screen } from '@testing-library/react';

const authorizedFetch = jest.fn();
jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));
jest.mock('@/components/client/ConsultationList', () => ({
  __esModule: true,
  default: () => <div>list</div>,
}));

// eslint-disable-next-line import/first
import ConsultationsPage from './page';

afterEach(() => jest.clearAllMocks());

it('локализует заголовок списка консультаций', async () => {
  authorizedFetch.mockResolvedValue([]);

  render(
    await ConsultationsPage({ params: Promise.resolve({ locale: 'kz' }) }),
  );

  expect(
    screen.getByRole('heading', { name: 'Кеңестер' }),
  ).toBeInTheDocument();
});
