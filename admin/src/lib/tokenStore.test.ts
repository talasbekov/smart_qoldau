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

  it('сохраняет и возвращает сессию', () => {
    tokenStore.set(session);
    expect(tokenStore.get()).toEqual(session);
  });

  it('clear() удаляет сессию', () => {
    tokenStore.set(session);
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });
});
