import type { Session } from './types';

const KEY = 'sq-admin-session';

export const tokenStore = {
  get(): Session | null {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  },
  set(session: Session): void {
    localStorage.setItem(KEY, JSON.stringify(session));
  },
  clear(): void {
    localStorage.removeItem(KEY);
  },
};
