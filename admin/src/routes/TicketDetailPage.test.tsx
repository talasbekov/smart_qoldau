import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TicketDetailPage from './TicketDetailPage';
import * as api from '@/lib/tickets';

vi.mock('@/lib/tickets');

function renderAt(id: string) {
  render(
    <MemoryRouter initialEntries={[`/tickets/${id}`]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TicketDetailPage', () => {
  it('показывает карточку и отправляет ответ', async () => {
    vi.mocked(api.getTicket).mockResolvedValue({
      id: 't1',
      category: 'OTHER',
      subject: 'Вопрос',
      status: 'NEW',
      team: 'SUPPORT_OPERATOR',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      body: 'Текст обращения',
      firstReplyAt: null,
      resolvedAt: null,
      authorType: 'GUEST',
      contactEmail: 'a@b.kz',
      contactPhone: null,
      messages: [],
    });
    vi.mocked(api.replyTicket).mockResolvedValue(undefined);

    renderAt('t1');
    await waitFor(() => expect(screen.getByText('Текст обращения')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Ответ'), { target: { value: 'Решаем вопрос' } });
    fireEvent.click(screen.getByText('Отправить ответ'));

    await waitFor(() => expect(api.replyTicket).toHaveBeenCalledWith('t1', 'Решаем вопрос'));
  });

  it('«Взять себе» вызывает assignTicket без аргумента', async () => {
    vi.mocked(api.getTicket).mockResolvedValue({
      id: 't1',
      category: 'OTHER',
      subject: 'Вопрос',
      status: 'NEW',
      team: 'SUPPORT_OPERATOR',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      body: 'Текст обращения',
      firstReplyAt: null,
      resolvedAt: null,
      authorType: 'GUEST',
      contactEmail: 'a@b.kz',
      contactPhone: null,
      messages: [],
    });
    vi.mocked(api.assignTicket).mockResolvedValue(undefined);

    renderAt('t1');
    await waitFor(() => expect(screen.getByText('Текст обращения')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Взять себе'));

    await waitFor(() => expect(api.assignTicket).toHaveBeenCalledWith('t1'));
  });
});
