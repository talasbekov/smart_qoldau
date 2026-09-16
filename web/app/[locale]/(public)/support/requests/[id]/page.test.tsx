import { render, screen } from '@testing-library/react';

const requireUser = jest.fn();
jest.mock('@/lib/auth/require-user', () => ({
  requireUser: (...args: unknown[]) => requireUser(...args),
}));
jest.mock('@/components/support/TicketConversation', () => ({
  __esModule: true,
  default: ({
    ticketId,
    locale,
    userId,
  }: {
    ticketId: string;
    locale: string;
    userId: string;
  }) => (
    <div>
      {ticketId}-{locale}-{userId}
    </div>
  ),
}));

// eslint-disable-next-line import/first
import SupportRequestPage from './page';

it('requires a session and passes the route id to the conversation', async () => {
  requireUser.mockResolvedValue({ id: 'user-1' });

  render(
    await SupportRequestPage({
      params: Promise.resolve({ locale: 'ru', id: 'ticket-1' }),
    }),
  );

  expect(requireUser).toHaveBeenCalledWith('ru');
  expect(screen.getByText('ticket-1-ru-user-1')).toBeInTheDocument();
});
