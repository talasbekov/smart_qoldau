/** @jest-environment node */
const store: Record<string, string | undefined> = {};
jest.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => store[key] ? { value: store[key] } : undefined }) }));
import { POST } from './route';
const realFetch = global.fetch;
const jwt = (seconds: number) => `x.${Buffer.from(JSON.stringify({ sub: 'user-a', exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.x`;
const request = (origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/auth/refresh', { method: 'POST', headers: { origin } });
beforeEach(() => { Object.keys(store).forEach((key) => delete store[key]); global.fetch = jest.fn(); });
afterEach(() => { global.fetch = realFetch; });
it('refreshes from HttpOnly cookie and returns identity without credentials', async () => {
  store.sq_rt = 'old-refresh';
  const access = jwt(240);
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ accessToken: access, refreshToken: 'new-refresh', user: { id: 'user-a' } }) });
  const result = await POST(request());
  expect(result.status).toBe(200);
  const body = await result.json();
  expect(body).toEqual({ user: { id: 'user-a', isGuest: false, isAdmin: false }, expiresAt: expect.any(Number) });
  expect(JSON.stringify(body)).not.toContain('refresh');
  const cookies = result.headers.getSetCookie().join(';');
  expect(cookies).toContain('sq_rt=new-refresh');
  expect(cookies).toContain('HttpOnly');
  expect(cookies).toMatch(/Max-Age=23[89]|Max-Age=240/);
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ refreshToken: 'old-refresh' });
});
it('avoids rotating again when an earlier tab already renewed access', async () => {
  store.sq_at = jwt(240);
  store.sq_rt = 'refresh';
  const result = await POST(request());
  expect(result.status).toBe(200);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(result.headers.getSetCookie()).toHaveLength(0);
});
it('rejects cross-origin refresh without contacting backend', async () => {
  expect((await POST(request('https://other.test'))).status).toBe(403);
  expect(global.fetch).not.toHaveBeenCalled();
});
it('does not clear or replace credentials on refresh rejection', async () => {
  store.sq_rt = 'revoked';
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { code: 'UNAUTHORIZED' } }) });
  const result = await POST(request());
  expect(result.status).toBe(401);
  expect(result.headers.getSetCookie()).toHaveLength(0);
});
it('returns a recoverable failure on network loss without retrying rotation', async () => {
  store.sq_rt = 'refresh';
  (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
  const result = await POST(request());
  expect(result.status).toBe(503);
  expect(result.headers.getSetCookie()).toHaveLength(0);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
