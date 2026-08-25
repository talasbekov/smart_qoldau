import { getFlaggedExperts } from './flaggedExperts';
import { apiFetch } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, apiFetch: vi.fn() };
});

describe('getFlaggedExperts', () => {
  it('GET /admin/experts/flagged с пагинацией', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    await getFlaggedExperts({ take: 20, skip: 0 });
    expect(apiFetch).toHaveBeenCalledWith('/admin/experts/flagged?take=20&skip=0');
  });
});
