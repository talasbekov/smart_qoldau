import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TotpChallengePage from './TotpChallengePage';
import * as auth from '@/lib/auth';

vi.mock('@/lib/auth');

describe('TotpChallengePage', () => {
  it('верный код завершает вход', async () => {
    const onSession = vi.fn();
    vi.mocked(auth.totpVerify).mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      admin: { id: '1', email: 'x', roles: [] },
    });

    render(<TotpChallengePage challengeToken="ct" onSession={onSession} />);

    fireEvent.change(screen.getByPlaceholderText('Код из приложения'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Подтвердить'));

    await waitFor(() => expect(onSession).toHaveBeenCalled());
    expect(auth.totpVerify).toHaveBeenCalledWith('ct', '123456');
  });
});
