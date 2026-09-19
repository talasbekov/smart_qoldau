import { changeSession, sessionFetch } from './browser-session';
const originalFetch = global.fetch;
let tail: Promise<unknown>;
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const active = () => response({ user: { id: 'a' }, expiresAt: Date.now() + 120_000 });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
beforeEach(() => {
  localStorage.clear();
  tail = Promise.resolve();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, work: () => unknown) => { const next = tail.then(work); tail = next.catch(() => undefined); return next; } } });
});
afterEach(() => { global.fetch = originalFetch; });
it('renews before submitting a mutation and never retries it after a network error', async () => {
  const calls: string[] = [];
  global.fetch = jest.fn(async (input) => {
    calls.push(String(input));
    if (input === '/api/auth/session') return response({ user: null, expiresAt: null });
    if (input === '/api/auth/refresh') return active();
    throw new Error('lost mutation response');
  }) as typeof fetch;
  await expect(sessionFetch('/api/proxy/requests', { method: 'POST' })).rejects.toThrow('lost mutation response');
  expect(calls).toEqual(['/api/auth/session', '/api/auth/refresh', '/api/proxy/requests']);
});
it('serializes concurrent renewal so the second tab sees the new access cookie', async () => {
  let fresh = false;
  let rotations = 0;
  global.fetch = jest.fn(async (input) => {
    if (input === '/api/auth/session') return fresh ? active() : response({ user: null, expiresAt: null });
    if (input === '/api/auth/refresh') { rotations++; fresh = true; return active(); }
    return response({ ok: true });
  }) as typeof fetch;
  await Promise.all([sessionFetch('/one'), sessionFetch('/two')]);
  expect(rotations).toBe(1);
});
it('logout waits for an in-flight refresh response so a late cookie cannot resurrect it', async () => {
  const rotating = deferred<Response>();
  const started = deferred<void>();
  const calls: string[] = [];
  global.fetch = jest.fn(async (input) => {
    calls.push(String(input));
    if (input === '/api/auth/session') return response({ user: null, expiresAt: null });
    if (input === '/api/auth/refresh') { started.resolve(); return rotating.promise; }
    return response({ ok: true });
  }) as typeof fetch;
  const first = sessionFetch('/one');
  await started.promise;
  const logout = changeSession('/api/auth/logout', { method: 'POST' });
  await Promise.resolve();
  expect(calls).not.toContain('/api/auth/logout');
  rotating.resolve(active());
  await Promise.all([first, logout]);
  expect(calls).toEqual(['/api/auth/session', '/api/auth/refresh', '/one', '/api/auth/logout']);
});
it('rejects work queued under A after a login switches to B', async () => {
  const loginResponse = deferred<Response>();
  global.fetch = jest.fn(async () => loginResponse.promise) as typeof fetch;
  const login = changeSession('/api/auth/verify-code', { method: 'POST' });
  const stale = sessionFetch('/api/proxy/requests', { method: 'POST' });
  const rejected = expect(stale).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  loginResponse.resolve(response({ user: { id: 'b' } }));
  await login;
  await rejected;
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
it('exposes logout rejection and preserves the session for a subsequent request', async () => {
  global.fetch = jest.fn(async (input) => input === '/api/auth/logout' ? response({}, 503) : input === '/api/auth/session' ? active() : response({ ok: true })) as typeof fetch;
  expect((await changeSession('/api/auth/logout', { method: 'POST' })).status).toBe(503);
  expect((await sessionFetch('/one')).ok).toBe(true);
});
it('fails closed without Web Locks instead of racing refresh or executing a mutation', async () => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  global.fetch = jest.fn();
  await expect(sessionFetch('/one', { method: 'POST' })).rejects.toMatchObject({ code: 'SESSION_LOCK_UNAVAILABLE' });
  expect(global.fetch).not.toHaveBeenCalled();
});
it('rejects a callback from the old document even if it starts after login completed', async () => {
  global.fetch = jest.fn(async () => response({ user: { id: 'b' } })) as typeof fetch;
  await changeSession('/api/auth/verify-code', { method: 'POST' });
  await expect(sessionFetch('/api/proxy/requests', { method: 'POST' })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
it('does not repeat an uncertain refresh on the next action, but explicit login can recover', async () => {
  let refreshCalls = 0;
  global.fetch = jest.fn(async (input) => {
    if (input === '/api/auth/session') return response({ user: null, expiresAt: null });
    if (input === '/api/auth/refresh') { refreshCalls++; throw new Error('lost response'); }
    return response({ user: { id: 'b' } });
  }) as typeof fetch;
  await expect(sessionFetch('/one')).rejects.toThrow();
  await expect(sessionFetch('/two')).rejects.toThrow();
  expect(refreshCalls).toBe(1);
  expect((await changeSession('/api/auth/verify-code', { method: 'POST' })).ok).toBe(true);
});
it('rejects stale SSR HTML belonging to A even when browser storage already belongs to B', async () => {
  document.body.innerHTML = '<main data-session-owner="a"></main>';
  global.fetch = jest.fn(async () => response({ user: { id: 'b' }, expiresAt: Date.now() + 120_000 })) as typeof fetch;
  try {
    await expect(sessionFetch('/api/proxy/requests', { method: 'POST' })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally { document.body.innerHTML = ''; }
});
it.each([{ id: 'b' }, null])('does not logout a different or unconfirmed session from SSR HTML for A (%j)', async (user) => {
  document.body.innerHTML = '<main data-session-owner="a"></main>';
  global.fetch = jest.fn(async () => response({ user, expiresAt: Date.now() + 120_000 })) as typeof fetch;
  try {
    await expect(changeSession('/api/auth/logout', { method: 'POST' })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/auth/session');
  } finally { document.body.innerHTML = ''; }
});
