import { tokenStore } from './tokenStore';
import type { Session } from './types';

const session: Session = {
  accessToken: 'a',
  refreshToken: 'r',
  admin: { id: '1', email: 'x@y.kz', roles: ['SUPERADMIN'] },
};

describe('tokenStore', () => {
  beforeEach(() => localStorage.clear());

  it('возвращает null, если сессии нет', () => {
    expect(tokenStore.get()).toBeNull();
  });

  it('сохраняет и возвращает сессию', async () => {
    await tokenStore.set(session);
    expect(tokenStore.get()).toEqual(session);
  });

  it('clear() удаляет сессию', async () => {
    await tokenStore.set(session);
    await tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });
});

it('does not clear a newer rotation on an old terminal error', async () => {
  await tokenStore.set(session);
  const before = tokenStore.snapshot();
  const rotated = { ...session, accessToken: 'new', refreshToken: 'new-r' };
  await tokenStore.replace(before, rotated);
  await tokenStore.clear(before, true);
  expect(tokenStore.get()).toEqual(rotated);
});

it('rejects stale login completion even after another login and logout', async () => {
  const before = tokenStore.snapshot();
  await tokenStore.set(session);
  await tokenStore.clear();
  await expect(tokenStore.set(session, before)).rejects.toThrow(
    'Сессия изменилась',
  );
  expect(tokenStore.get()).toBeNull();
});

it('an explicit logout clears a rotation of the same identity', async () => {
  await tokenStore.set(session);
  const before = tokenStore.snapshot();
  await tokenStore.replace(before, {
    ...session,
    accessToken: 'new',
    refreshToken: 'new-r',
  });
  await tokenStore.clear(before);
  expect(tokenStore.get()).toBeNull();
});

it('requires login for an unversioned stored session', () => {
  localStorage.setItem('sq-admin-session', JSON.stringify(session));
  expect(tokenStore.get()).toBeNull();
});

it('fails promptly without Web Locks instead of performing an unsafe write', async () => {
  await tokenStore.set(session);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: undefined,
  });
  await expect(tokenStore.clear()).rejects.toThrow('Web Locks');
  expect(tokenStore.get()).toBeNull();
});

it('failed logout storage write closes this tab and reports failure; retry persists logout', async () => {
  await tokenStore.set(session);
  const before = tokenStore.snapshot();
  const write = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('storage denied');
    });
  await expect(tokenStore.clear(before)).rejects.toThrow('storage denied');
  expect(tokenStore.get()).toBeNull();
  write.mockRestore();
  await tokenStore.clear(before);
  vi.resetModules();
  expect((await import('./tokenStore')).tokenStore.get()).toBeNull();
});

it('does not revive a cached session after storage reads fail', async () => {
  await tokenStore.set(session);
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  expect(tokenStore.get()).toBeNull();
  read.mockRestore();
  expect(tokenStore.get()).toBeNull();
  // An explicit new login may recover storage; old async work cannot.
  await tokenStore.set(session);
  expect(tokenStore.get()).toEqual(session);
});
