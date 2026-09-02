import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiFetch = jest.fn().mockResolvedValue(null);
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
}));
const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

// eslint-disable-next-line import/first
import ReviewList from './ReviewList';

const review = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  rating: 5,
  publicText: 'Помогла разобраться',
  expertReply: null,
  tags: ['attentive'],
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

afterEach(() => jest.clearAllMocks());

describe('ReviewList', () => {
  it('пусто — так и говорит', () => {
    render(<ReviewList items={[]} ratingAvg={0} ratingCount={0} distribution={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }} />);

    expect(screen.getByText(/отзывов пока нет/i)).toBeInTheDocument();
  });

  it('показывает средний балл и число отзывов', () => {
    render(<ReviewList items={[review()]} ratingAvg={4.9} ratingCount={312} distribution={{ 1: 2, 2: 3, 3: 10, 4: 57, 5: 240 }} />);

    expect(screen.getByText(/4[.,]9/)).toBeInTheDocument();
    expect(screen.getByText(/312/)).toBeInTheDocument();
  });

  it('не показывает имени клиента', () => {
    render(<ReviewList items={[review()]} ratingAvg={5} ratingCount={1} distribution={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }} />);

    expect(screen.getByText(/Анонимный клиент/)).toBeInTheDocument();
  });

  it('на отзыв без ответа предлагает ответить', () => {
    render(<ReviewList items={[review()]} ratingAvg={5} ratingCount={1} distribution={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }} />);

    expect(screen.getByRole('button', { name: 'Ответить' })).toBeInTheDocument();
  });

  it('на отзыв с ответом отвечать второй раз не предлагает', () => {
    render(
      <ReviewList
        items={[review({ expertReply: 'Спасибо!' })]}
        ratingAvg={5}
        ratingCount={1}
        distribution={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Ответить' })).toBeNull();
    expect(screen.getByText('Спасибо!')).toBeInTheDocument();
  });

  it('отправляет ответ и обновляет страницу', async () => {
    render(<ReviewList items={[review()]} ratingAvg={5} ratingCount={1} distribution={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ответить' }));
    fireEvent.change(screen.getByLabelText('Ваш ответ'), { target: { value: 'Спасибо за отзыв' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        'reviews/r1/reply',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('пустой ответ не отправляет', async () => {
    render(<ReviewList items={[review()]} ratingAvg={5} ratingCount={1} distribution={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ответить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('даёт пожаловаться на отзыв', () => {
    render(<ReviewList items={[review()]} ratingAvg={5} ratingCount={1} distribution={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }} />);

    expect(screen.getByRole('button', { name: /Пожаловаться/ })).toBeInTheDocument();
  });
});
