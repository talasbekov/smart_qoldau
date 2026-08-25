import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReviewsModerationPage from './ReviewsModerationPage';
import * as api from '@/lib/reviewsModeration';

vi.mock('@/lib/reviewsModeration');

describe('ReviewsModerationPage', () => {
  it('показывает жалобу и скрывает отзыв', async () => {
    vi.mocked(api.getFlaggedReviews).mockResolvedValue([
      { id: 'r1', expertId: 'e1', rating: 1, publicText: 'плохо', privateText: null, complaint: 'оскорбления', createdAt: '2026-01-01' },
    ]);
    vi.mocked(api.resolveReview).mockResolvedValue(undefined);

    render(<ReviewsModerationPage />);
    await waitFor(() => expect(screen.getByText('оскорбления')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Скрыть'));

    await waitFor(() => expect(api.resolveReview).toHaveBeenCalledWith('r1', { action: 'hide', comment: undefined }));
  });
});
