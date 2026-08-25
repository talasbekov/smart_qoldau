import { render, screen, waitFor } from '@testing-library/react';
import FlaggedExpertsPage from './FlaggedExpertsPage';
import * as api from '@/lib/flaggedExperts';

vi.mock('@/lib/flaggedExperts');

describe('FlaggedExpertsPage', () => {
  it('показывает экспертов с рейтингом ниже порога', async () => {
    vi.mocked(api.getFlaggedExperts).mockResolvedValue([{ id: 'e1', displayName: 'Иван И.', ratingAvg: 3.2, ratingCount: 25 }]);
    render(<FlaggedExpertsPage />);
    await waitFor(() => expect(screen.getByText('Иван И.')).toBeInTheDocument());
    expect(screen.getByText('3.2')).toBeInTheDocument();
  });
});
