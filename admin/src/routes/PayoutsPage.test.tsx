import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PayoutsPage from './PayoutsPage';
import * as api from '@/lib/payouts';

vi.mock('@/lib/payouts');

describe('PayoutsPage', () => {
  it('показывает сумму в тенге и одобряет вывод', async () => {
    vi.mocked(api.listPayouts).mockResolvedValue({
      items: [
        {
          id: 'p1',
          expertId: 'e1',
          amountTiyn: 500000,
          maskedPan: '**** 1111',
          holderName: 'IVANOV I',
          monthTotalTiyn: 500000,
          createdAt: '2026-01-01',
        },
      ],
    });
    vi.mocked(api.approvePayout).mockResolvedValue(undefined);

    render(<PayoutsPage />);
    await waitFor(() => expect(screen.getAllByText(/5.000.₸/)).toHaveLength(2));

    fireEvent.click(screen.getByText('Одобрить'));

    await waitFor(() => expect(api.approvePayout).toHaveBeenCalledWith('p1'));
  });
});
