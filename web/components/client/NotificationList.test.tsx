import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
}));
const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

// eslint-disable-next-line import/first
import NotificationList from './NotificationList';

const item = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  type: 'consultation.updated',
  title: 'Специалист найден',
  body: 'Айгуль С. готова начать',
  data: {},
  readAt: null,
  createdAt: '2026-09-02T10:00:00.000Z',
  ...over,
});

afterEach(() => jest.clearAllMocks());

describe('NotificationList', () => {
  it('пустой список объясняется словами', () => {
    render(<NotificationList items={[]} unreadCount={0} />);

    expect(screen.getByText(/пока нет уведомлений/i)).toBeInTheDocument();
  });

  it('непрочитанное отличается от прочитанного не только цветом', () => {
    render(<NotificationList items={[item()]} unreadCount={1} />);

    // Цвет один опознавательный признак не образует: он недоступен
    // части людей и не читается скринридером.
    expect(screen.getByText('Новое')).toBeInTheDocument();
  });

  it('помечает всё прочитанным одним действием', async () => {
    apiFetch.mockResolvedValue(null);
    render(<NotificationList items={[item()]} unreadCount={1} />);

    fireEvent.click(screen.getByRole('button', { name: /Прочитано/ }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        'notifications/read',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('не предлагает пометить прочитанным, когда непрочитанных нет', () => {
    render(
      <NotificationList
        items={[item({ readAt: '2026-09-02T11:00:00.000Z' })]}
        unreadCount={0}
      />,
    );

    expect(screen.queryByRole('button', { name: /Прочитано/ })).toBeNull();
  });
});

it('shows a recoverable error instead of refreshing after a failed read mutation', async () => {
  apiFetch
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(null);
  render(<NotificationList items={[item()]} unreadCount={1} />);
  fireEvent.click(screen.getByRole('button', { name: 'Прочитано' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Не удалось/);
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByText('Новое')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Прочитано' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('localizes notification controls in Kazakh', () => {
  render(<NotificationList items={[item()]} unreadCount={1} locale="kz" />);
  expect(screen.getByRole('button', { name: 'Оқылды' })).toBeInTheDocument();
  expect(screen.getByText('Жаңа')).toBeInTheDocument();
});
