import { listPayouts, approvePayout, rejectPayout } from './payouts';
import { apiFetch } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, apiFetch: vi.fn() };
});

describe('payouts API', () => {
  it('listPayouts -> GET /admin/payouts (по умолчанию PENDING_REVIEW)', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [] });
    await listPayouts({ take: 20, skip: 0 });
    expect(apiFetch).toHaveBeenCalledWith('/admin/payouts?take=20&skip=0');
  });

  it('listPayouts передаёт status, если указан', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [] });
    await listPayouts({ status: 'APPROVED', take: 20, skip: 0 });
    expect(apiFetch).toHaveBeenCalledWith('/admin/payouts?status=APPROVED&take=20&skip=0');
  });

  it('approvePayout -> POST /admin/payouts/:id/approve', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await approvePayout('p1');
    expect(apiFetch).toHaveBeenCalledWith('/admin/payouts/p1/approve', { method: 'POST' });
  });

  it('rejectPayout -> POST /admin/payouts/:id/reject с причиной', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await rejectPayout('p1', 'подозрительная активность');
    expect(apiFetch).toHaveBeenCalledWith('/admin/payouts/p1/reject', {
      method: 'POST',
      body: JSON.stringify({ reason: 'подозрительная активность' }),
    });
  });
});
