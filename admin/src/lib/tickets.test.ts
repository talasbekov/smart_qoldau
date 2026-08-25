import { listTickets, getTicket, replyTicket, resolveTicket, assignTicket } from './tickets';
import { apiFetch } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, apiFetch: vi.fn() };
});

describe('tickets API', () => {
  it('listTickets -> GET /admin/tickets с фильтрами', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [], total: 0 });
    await listTickets({ status: 'NEW', assigned: 'me', take: 20, skip: 0 });
    expect(apiFetch).toHaveBeenCalledWith('/admin/tickets?status=NEW&assigned=me&take=20&skip=0');
  });

  it('getTicket -> GET /admin/tickets/:id', async () => {
    vi.mocked(apiFetch).mockResolvedValue({});
    await getTicket('t1');
    expect(apiFetch).toHaveBeenCalledWith('/admin/tickets/t1');
  });

  it('replyTicket -> POST /admin/tickets/:id/reply', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await replyTicket('t1', 'Ответ');
    expect(apiFetch).toHaveBeenCalledWith('/admin/tickets/t1/reply', { method: 'POST', body: JSON.stringify({ body: 'Ответ' }) });
  });

  it('resolveTicket -> POST /admin/tickets/:id/resolve', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await resolveTicket('t1');
    expect(apiFetch).toHaveBeenCalledWith('/admin/tickets/t1/resolve', { method: 'POST' });
  });

  it('assignTicket -> POST /admin/tickets/:id/assign', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await assignTicket('t1', 'admin2');
    expect(apiFetch).toHaveBeenCalledWith('/admin/tickets/t1/assign', { method: 'POST', body: JSON.stringify({ adminUserId: 'admin2' }) });
  });

  it('assignTicket(id, null) снимает назначение', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await assignTicket('t1', null);
    expect(apiFetch).toHaveBeenCalledWith('/admin/tickets/t1/assign', { method: 'POST', body: JSON.stringify({ adminUserId: null }) });
  });
});
