import { getModerationQueue, decidePhoto, decideAbout } from './profileModeration';
import { apiFetch } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, apiFetch: vi.fn() };
});

describe('profileModeration API', () => {
  it('getModerationQueue -> GET /admin/profile-moderation', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [], total: 0 });
    await getModerationQueue({ take: 20, skip: 0 });
    expect(apiFetch).toHaveBeenCalledWith('/admin/profile-moderation?take=20&skip=0');
  });

  it('decidePhoto -> POST .../photo/decision', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await decidePhoto('exp1', { action: 'approve' });
    expect(apiFetch).toHaveBeenCalledWith('/admin/profile-moderation/exp1/photo/decision', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    });
  });

  it('decideAbout -> POST .../about/decision', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await decideAbout('exp1', { action: 'reject', comment: 'x' });
    expect(apiFetch).toHaveBeenCalledWith('/admin/profile-moderation/exp1/about/decision', {
      method: 'POST',
      body: JSON.stringify({ action: 'reject', comment: 'x' }),
    });
  });
});
