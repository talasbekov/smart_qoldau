import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import App from './App';
import { tokenStore } from './lib/tokenStore';
import type { Session } from './lib/types';

const a: Session = {
  accessToken: 'a',
  refreshToken: 'ar',
  admin: { id: 'A', email: 'a@x.kz', roles: ['SUPERADMIN'] },
};
const b: Session = {
  accessToken: 'b',
  refreshToken: 'br',
  admin: { id: 'B', email: 'b@x.kz', roles: ['SUPPORT_OPERATOR'] },
};
beforeEach(async () => {
  localStorage.clear();
  window.history.replaceState({}, '', '/verification');
  await tokenStore.set(a);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([]))),
  );
});
afterEach(() => vi.unstubAllGlobals());

it('logout updates routing without a page reload', async () => {
  await act(async () => {
    render(<App />);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument(),
  );
  expect(tokenStore.get()).toBeNull();
  expect(window.location.pathname).toBe('/login');
});

it('a storage event replaces the displayed account and role gates', async () => {
  await act(async () => {
    render(<App />);
  });
  expect(screen.getByText('a@x.kz')).toBeInTheDocument();
  await act(async () => {
    // Another module represents a separate tab, with independent listeners.
    vi.resetModules();
    const other = (await import('./lib/tokenStore')).tokenStore;
    await other.set(b);
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'sq-admin-session' }),
    );
  });
  expect(screen.getByText('b@x.kz')).toBeInTheDocument();
  expect(screen.queryByText('a@x.kz')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Сотрудники' }),
  ).not.toBeInTheDocument();
});

it('reports a failed persisted logout and offers a working retry', async () => {
  await act(async () => {
    render(<App />);
  });
  const write = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('denied');
    });
  fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'не удалось сохранить выход',
  );
  write.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить выход' }));
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  );
  vi.resetModules();
  expect((await import('./lib/tokenStore')).tokenStore.get()).toBeNull();
});
