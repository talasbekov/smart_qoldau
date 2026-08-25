import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TicketsPage from './TicketsPage';
import * as api from '@/lib/tickets';

vi.mock('@/lib/tickets');

describe('TicketsPage', () => {
  it('показывает список тикетов', async () => {
    vi.mocked(api.listTickets).mockResolvedValue({
      items: [
        { id: 't1', category: 'OTHER', subject: 'Вопрос', status: 'NEW', team: 'SUPPORT_OPERATOR', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ],
      total: 1,
    });
    render(
      <MemoryRouter>
        <TicketsPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Вопрос')).toBeInTheDocument());
  });
});
