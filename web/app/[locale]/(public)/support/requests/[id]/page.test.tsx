import { render, screen } from '@testing-library/react';

const requireUser = jest.fn();
jest.mock('@/lib/auth/require-user', () => ({
  requireUser: (...args: unknown[]) => requireUser(...args),
}));
jest.mock('@/components/support/TicketConversation', () => ({
  __esModule: true,
  default: ({ ticketId, locale }: { ticketId: string; locale: string }) => (
    <div>
      {ticketId}-{locale}
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
  expect(screen.getByText('ticket-1-ru')).toBeInTheDocument();
});
