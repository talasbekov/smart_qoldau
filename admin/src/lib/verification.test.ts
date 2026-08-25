import { getQueue, decideDocument, decideExpert, blockExpert, unblockExpert } from './verification';
import { apiFetch } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, apiFetch: vi.fn() };
});

describe('verification API', () => {
  it('getQueue -> GET /admin/verification/queue', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    await getQueue();
    expect(apiFetch).toHaveBeenCalledWith('/admin/verification/queue');
  });

  it('decideDocument -> POST /admin/verification/documents/:id/decision', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await decideDocument('doc1', { approve: true });
    expect(apiFetch).toHaveBeenCalledWith('/admin/verification/documents/doc1/decision', {
      method: 'POST',
      body: JSON.stringify({ approve: true }),
    });
  });

  it('decideExpert -> POST /admin/verification/:id/decision', async () => {
    vi.mocked(apiFetch).mockResolvedValue({});
    await decideExpert('exp1', { approve: false, comment: 'x' });
    expect(apiFetch).toHaveBeenCalledWith('/admin/verification/exp1/decision', {
      method: 'POST',
      body: JSON.stringify({ approve: false, comment: 'x' }),
    });
  });

  it('blockExpert -> POST /admin/experts/:id/block с причиной', async () => {
    vi.mocked(apiFetch).mockResolvedValue({});
    await blockExpert('exp1', 'жалобы клиентов');
    expect(apiFetch).toHaveBeenCalledWith('/admin/experts/exp1/block', {
      method: 'POST',
      body: JSON.stringify({ reason: 'жалобы клиентов' }),
    });
  });

  it('unblockExpert -> POST /admin/experts/:id/unblock', async () => {
    vi.mocked(apiFetch).mockResolvedValue({});
    await unblockExpert('exp1');
    expect(apiFetch).toHaveBeenCalledWith('/admin/experts/exp1/unblock', { method: 'POST' });
  });
});
