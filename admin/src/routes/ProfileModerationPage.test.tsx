import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileModerationPage from './ProfileModerationPage';
import * as api from '@/lib/profileModeration';

vi.mock('@/lib/profileModeration');

describe('ProfileModerationPage', () => {
  it('показывает очередь и решает по фото', async () => {
    vi.mocked(api.getModerationQueue).mockResolvedValue({
      items: [
        {
          expertId: 'e1',
          displayName: 'Иван И.',
          photoPendingUrl: 'http://x/photo.jpg',
          aboutPending: null,
          submittedAt: '2026-01-01',
        },
      ],
      total: 1,
    });
    vi.mocked(api.decidePhoto).mockResolvedValue(undefined);

    render(<ProfileModerationPage />);
    await waitFor(() => expect(screen.getByText('Иван И.')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Одобрить фото'));

    await waitFor(() => expect(api.decidePhoto).toHaveBeenCalledWith('e1', { action: 'approve' }));
  });
});
