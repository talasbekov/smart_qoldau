import { RENEW_BEFORE_MS } from './token-expiry';

const LOCK = 'sq-auth-session';
const EPOCH = 'sq:auth:epoch:v1';
const UNCERTAIN = 'sq:auth:uncertain:v1';
export const SESSION_CHANGE_EVENT = 'sq-session-change';

export class SessionError extends Error {
  constructor(readonly code: string, readonly status = 401) {
    super(code);
    this.name = 'SessionError';
  }
}

export function sessionEpoch(): string {
  try { return localStorage.getItem(EPOCH) ?? ''; }
  catch { throw new SessionError('SESSION_LOCK_UNAVAILABLE'); }
}

// Bound once to this browser document. Async callbacks from an old account
// cannot adopt the next account merely because they started after its login.
const DOCUMENT_EPOCH = (() => {
  if (typeof window === 'undefined') return '';
  try { return sessionEpoch(); } catch { return null; }
})();
export function documentSessionEpoch(): string {
  if (DOCUMENT_EPOCH === null) throw new SessionError('SESSION_LOCK_UNAVAILABLE');
  return DOCUMENT_EPOCH;
}

async function locked<T>(expectedEpoch: string, work: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) {
    throw new SessionError('SESSION_LOCK_UNAVAILABLE');
  }
  return navigator.locks.request(LOCK, async () => {
    if (sessionEpoch() !== expectedEpoch) throw new SessionError('SESSION_CHANGED', 409);
    return work();
  });
}

// Every credential-writing browser request uses this same lock, including login
// and logout. Holding it until the response prevents late refresh Set-Cookie
// from overwriting a newer login or resurrecting a logged-out session.
export function changeSession(path: '/api/auth/verify-code' | '/api/auth/logout', init: RequestInit): Promise<Response> {
  const epoch = path === '/api/auth/logout' ? documentSessionEpoch() : sessionEpoch();
  return locked(epoch, async () => {
    const expectedOwner = typeof document === 'undefined' ? null : document.querySelector('[data-session-owner]')?.getAttribute('data-session-owner') ?? null;
    if (path === '/api/auth/logout' && expectedOwner) {
      const probe = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!probe.ok) throw new SessionError('SESSION_UNAVAILABLE', probe.status);
      const session = await probe.json() as Session;
      if (session.user?.id !== expectedOwner) throw new SessionError('SESSION_CHANGED', 409);
    }
    const response = await fetch(path, init);
    if (response.ok) {
      localStorage.setItem(EPOCH, crypto.randomUUID());
      localStorage.removeItem(UNCERTAIN);
      window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
    }
    return response;
  });
}

type Session = { user: { id: string } | null; expiresAt: number | null };
async function ensureSession(expectedOwner: string | null = null): Promise<void> {
  const probe = await fetch('/api/auth/session', { cache: 'no-store' });
  if (!probe.ok) throw new SessionError('SESSION_UNAVAILABLE', probe.status);
  const session = await probe.json() as Session;
  if (expectedOwner && session.user && session.user.id !== expectedOwner) throw new SessionError('SESSION_CHANGED', 409);
  if (session.user && session.expiresAt && session.expiresAt > Date.now() + RENEW_BEFORE_MS) {
    localStorage.removeItem(UNCERTAIN);
    return;
  }
  if (localStorage.getItem(UNCERTAIN) === sessionEpoch()) throw new SessionError('SESSION_UNAVAILABLE', 503);
  let refreshed: Response;
  try {
    refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
  } catch (error) {
    localStorage.setItem(UNCERTAIN, sessionEpoch());
    throw error;
  }
  if (refreshed.status >= 500) localStorage.setItem(UNCERTAIN, sessionEpoch());
  if (!refreshed.ok) throw new SessionError('SESSION_UNAVAILABLE', refreshed.status);
  const renewed = await refreshed.json() as Session;
  if (expectedOwner && renewed.user && renewed.user.id !== expectedOwner) throw new SessionError('SESSION_CHANGED', 409);
  if (!renewed.user || !renewed.expiresAt || renewed.expiresAt <= Date.now()) {
    throw new SessionError('SESSION_UNAVAILABLE');
  }
}

// Preflight happens before the operation. Never retry mutations after a 401 or
// network failure: the original server action may already have completed.
export function sessionFetch(path: string, init: RequestInit = {}, expectedEpoch = documentSessionEpoch()): Promise<Response> {
  const expectedOwner = typeof document === 'undefined' ? null : document.querySelector('[data-session-owner]')?.getAttribute('data-session-owner') ?? null;
  return locked(expectedEpoch, async () => {
    await ensureSession(expectedOwner);
    return fetch(path, init);
  });
}

export function renewSession(): Promise<void> {
  return locked(documentSessionEpoch(), () => ensureSession());
}
