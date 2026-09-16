import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import * as auth from '@/lib/auth';

vi.mock('@/lib/auth');

describe('LoginPage', () => {
  it('успешный вход без 2FA переходит на главную', async () => {
    const setSession = vi.fn();
    vi.mocked(auth.login).mockResolvedValue({
      kind: 'session',
      session: {
        accessToken: 'a',
        refreshToken: 'r',
        admin: { id: '1', email: 'x', roles: [] },
      },
    });

    render(
      <MemoryRouter>
        <LoginPage onSession={setSession} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'x@y.kz' },
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByText('Войти'));

    await waitFor(() => expect(setSession).toHaveBeenCalled());
  });

  it('при totpRequired вызывает onTotpChallenge с challengeToken', async () => {
    const onTotpChallenge = vi.fn();
    vi.mocked(auth.login).mockResolvedValue({
      kind: 'totp',
      challengeToken: 'ct',
    });

    render(
      <MemoryRouter>
        <LoginPage onSession={vi.fn()} onTotpChallenge={onTotpChallenge} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'x@y.kz' },
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByText('Войти'));

    await waitFor(() => expect(onTotpChallenge).toHaveBeenCalledWith('ct'));
  });
});

it('ignores a login result after the form is unmounted', async () => {
  let resolve!: (result: auth.LoginResult) => void;
  vi.mocked(auth.login).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const onSession = vi.fn();
  const { unmount } = render(<LoginPage onSession={onSession} />);
  fireEvent.change(screen.getByPlaceholderText('Email'), {
    target: { value: 'a@x.kz' },
  });
  fireEvent.change(screen.getByPlaceholderText('Пароль'), {
    target: { value: 'pass' },
  });
  fireEvent.click(screen.getByText('Войти'));
  unmount();
  resolve({
    kind: 'session',
    session: {
      accessToken: 'a',
      refreshToken: 'r',
      admin: { id: 'A', email: 'a', roles: [] },
    },
  });
  await waitFor(() => expect(auth.login).toHaveResolved());
  expect(onSession).not.toHaveBeenCalled();
});
