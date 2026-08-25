import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VerificationQueuePage from './VerificationQueuePage';
import * as verificationApi from '@/lib/verification';

vi.mock('@/lib/verification');

describe('VerificationQueuePage', () => {
  it('показывает очередь и решает по анкете эксперта', async () => {
    vi.mocked(verificationApi.getQueue).mockResolvedValue([
      { id: 'exp1', displayName: 'Иван И.', verificationStatus: 'PENDING', documents: [] },
    ]);
    vi.mocked(verificationApi.decideExpert).mockResolvedValue({});

    render(<VerificationQueuePage />);
    await waitFor(() => expect(screen.getByText('Иван И.')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Решение по анкете'));
    fireEvent.click(screen.getByText('Одобрить'));

    await waitFor(() =>
      expect(verificationApi.decideExpert).toHaveBeenCalledWith('exp1', { approve: true, comment: undefined }),
    );
  });
});
