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

    fireEvent.change(screen.getByPlaceholderText('Код из приложения'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('Подтвердить'));

    await waitFor(() => expect(onSession).toHaveBeenCalled());
    expect(auth.totpVerify).toHaveBeenCalledWith('ct', '123456');
  });
});

it('ignores verification finishing after the challenge page is unmounted', async () => {
  let resolve!: (session: Awaited<ReturnType<typeof auth.totpVerify>>) => void;
  vi.mocked(auth.totpVerify).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const onSession = vi.fn();
  const { unmount } = render(
    <TotpChallengePage challengeToken="ct" onSession={onSession} />,
  );
  fireEvent.change(screen.getByPlaceholderText('Код из приложения'), {
    target: { value: '123456' },
  });
  fireEvent.click(screen.getByText('Подтвердить'));
  unmount();
  resolve({
    accessToken: 'a',
    refreshToken: 'r',
    admin: { id: 'A', email: 'a', roles: [] },
  });
  await waitFor(() => expect(auth.totpVerify).toHaveResolved());
  expect(onSession).not.toHaveBeenCalled();
});
