import { getFlaggedReviews, resolveReview } from './reviewsModeration';
import { apiFetch } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, apiFetch: vi.fn() };
});

describe('reviewsModeration API', () => {
  it('getFlaggedReviews -> GET /admin/reviews/flagged', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    await getFlaggedReviews();
    expect(apiFetch).toHaveBeenCalledWith('/admin/reviews/flagged');
  });

  it('resolveReview -> POST /admin/reviews/:id/resolve', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await resolveReview('r1', { action: 'hide', comment: 'оскорбления' });
    expect(apiFetch).toHaveBeenCalledWith('/admin/reviews/r1/resolve', {
      method: 'POST',
      body: JSON.stringify({ action: 'hide', comment: 'оскорбления' }),
    });
  });
});
