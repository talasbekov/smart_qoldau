import { apiFetch } from './api';
import { tokenStore } from './tokenStore';
import type { Session } from './types';

const a: Session = {
  accessToken: 'a1',
  refreshToken: 'ar1',
  admin: { id: 'A', email: 'a@x.kz', roles: ['SUPERADMIN'] },
};
const b: Session = {
  accessToken: 'b1',
  refreshToken: 'br1',
  admin: { id: 'B', email: 'b@x.kz', roles: ['SUPPORT_OPERATOR'] },
};
const rotated: Session = {
  ...a,
  accessToken: 'a2',
  refreshToken: 'ar2',
  admin: { ...a.admin, roles: ['SUPPORT_OPERATOR'] },
};
const response = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  localStorage.clear();
  await tokenStore.set(a);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it('coalesces parallel 401s and keeps roles returned by refresh', async () => {
  const refresh = deferred<Response>();
  const sent: string[] = [];
  let refreshes = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/refresh')) {
        refreshes++;
        return refresh.promise.then((res) => res.clone());
      }
      const bearer = new Headers(init.headers).get('Authorization')!;
      sent.push(bearer);
      return Promise.resolve(
        response(bearer === 'Bearer a1' ? 401 : 200, { ok: true }),
      );
    }),
  );
  const requests = Promise.all([
    apiFetch('/admin/staff'),
    apiFetch('/admin/settings'),
  ]);
  await vi.waitFor(() => expect(refreshes).toBeGreaterThan(0));
  refresh.resolve(response(200, rotated));
  await expect(requests).resolves.toEqual([{ ok: true }, { ok: true }]);
  expect(refreshes).toBe(1);
  expect(sent).toEqual(['Bearer a1', 'Bearer a1', 'Bearer a2', 'Bearer a2']);
  expect(tokenStore.get()).toEqual(rotated);
});

it.each(['logout', 'switch', 'same-account-login'] as const)(
  'does not resurrect A after %s during refresh',
  async (action) => {
    const refresh = deferred<Response>();
    let refreshing = false;
    const sent: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        if (url.endsWith('/refresh')) {
          refreshing = true;
          return refresh.promise.then((res) => res.clone());
        }
        sent.push(new Headers(init.headers).get('Authorization')!);
        return Promise.resolve(response(401));
      }),
    );
    const result = apiFetch('/admin/staff').catch((error) => error);
    await vi.waitFor(() => expect(refreshing).toBe(true));
    if (action === 'logout') await tokenStore.clear();
    else await tokenStore.set(action === 'switch' ? b : a);
    refresh.resolve(response(200, rotated));
    expect(await result).toBeInstanceOf(Error);
    expect(tokenStore.get()).toEqual(
      action === 'logout' ? null : action === 'switch' ? b : a,
    );
    expect(sent).toEqual(['Bearer a1']);
  },
);

it('does not refresh or retry an A request as B after a delayed 401', async () => {
  const original = deferred<Response>();
  const sent: { url: string; body?: BodyInit | null; headers?: HeadersInit }[] =
    [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      sent.push({ url, body: init.body, headers: init.headers });
      return sent.length === 1
        ? original.promise
        : Promise.resolve(response(200, b));
    }),
  );
  const result = apiFetch('/admin/staff', {
    method: 'POST',
    body: '{"action":"A-only"}',
  }).catch((error) => error);
  await tokenStore.set(b);
  original.resolve(response(401));
  expect(await result).toBeInstanceOf(Error);
  expect(sent).toHaveLength(1);
  expect(tokenStore.get()).toEqual(b);
});

it('late refresh failure from A cannot clear B', async () => {
  const refresh = deferred<Response>();
  let refreshing = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('/refresh')) {
        refreshing = true;
        return refresh.promise.then((res) => res.clone());
      }
      return Promise.resolve(response(401));
    }),
  );
  const result = apiFetch('/admin/staff').catch((error) => error);
  await vi.waitFor(() => expect(refreshing).toBe(true));
  await tokenStore.set(b);
  refresh.resolve(response(401));
  expect(await result).toBeInstanceOf(Error);
  expect(tokenStore.get()).toEqual(b);
});

it('reuses a completed rotation for a late 401 without rotating twice', async () => {
  const slow = deferred<Response>();
  let refreshes = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/refresh')) {
        refreshes++;
        return Promise.resolve(response(200, rotated));
      }
      const bearer = new Headers(init.headers).get('Authorization')!;
      if (url.endsWith('/slow') && bearer === 'Bearer a1') return slow.promise;
      return Promise.resolve(
        response(bearer === 'Bearer a1' ? 401 : 200, { ok: true }),
      );
    }),
  );
  const late = apiFetch('/slow');
  await apiFetch('/fast');
  slow.resolve(response(401));
  await expect(late).resolves.toEqual({ ok: true });
  expect(refreshes).toBe(1);
});

it('shares rotation between independent tabs', async () => {
  vi.resetModules();
  const otherApi = (await import('./api')).apiFetch;
  const refresh = deferred<Response>();
  let refreshes = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/refresh')) {
        refreshes++;
        return refresh.promise.then((res) => res.clone());
      }
      const bearer = new Headers(init.headers).get('Authorization');
      return Promise.resolve(
        response(bearer === 'Bearer a1' ? 401 : 200, { ok: true }),
      );
    }),
  );
  const requests = Promise.all([apiFetch('/one'), otherApi('/two')]);
  await vi.waitFor(() => expect(refreshes).toBe(1));
  refresh.resolve(response(200, rotated));
  await expect(requests).resolves.toEqual([{ ok: true }, { ok: true }]);
  expect(refreshes).toBe(1);
});

it('rejects a late successful body after A switches to B', async () => {
  const body = deferred<unknown>();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: () => body.promise })),
  );
  const result = apiFetch('/private').catch((error) => error);
  await Promise.resolve();
  await tokenStore.set(b);
  body.resolve({ private: 'A' });
  expect(await result).toMatchObject({ code: 'ADMIN_SESSION_CHANGED' });
});

it('does not retry an aborted caller after a shared refresh', async () => {
  const refresh = deferred<Response>();
  const controller = new AbortController();
  let refreshes = 0;
  let requests = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('/refresh')) {
        refreshes++;
        return refresh.promise;
      }
      requests++;
      return Promise.resolve(response(401));
    }),
  );
  const result = apiFetch('/private', { signal: controller.signal }).catch(
    (error) => error,
  );
  await vi.waitFor(() => expect(refreshes).toBe(1));
  controller.abort();
  refresh.resolve(response(200, rotated));
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(requests).toBe(1);
});

it.each([503, 'network', 'malformed', 'wrong-account'] as const)(
  'preserves current session on %s refresh failure and releases singleflight',
  async (failure) => {
    let refreshes = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        if (url.endsWith('/refresh')) {
          refreshes++;
          if (refreshes > 1) return Promise.resolve(response(200, rotated));
          if (failure === 'network')
            return Promise.reject(new TypeError('offline'));
          if (failure === 'malformed')
            return Promise.resolve(response(200, {}));
          if (failure === 'wrong-account')
            return Promise.resolve(response(200, b));
          return Promise.resolve(response(failure));
        }
        return Promise.resolve(
          response(
            new Headers(init.headers).get('Authorization') === 'Bearer a2'
              ? 200
              : 401,
            { ok: true },
          ),
        );
      }),
    );
    await expect(apiFetch('/one')).rejects.toBeInstanceOf(Error);
    expect(tokenStore.get()).toEqual(a);
    await expect(apiFetch('/two')).resolves.toEqual({ ok: true });
    expect(refreshes).toBe(2);
  },
);

it('stops after a rejected retry and clears that exact session', async () => {
  let requests = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/refresh')) return response(200, rotated);
      requests++;
      return response(401);
    }),
  );
  await expect(apiFetch('/one')).rejects.toMatchObject({ status: 401 });
  expect(requests).toBe(2);
  expect(tokenStore.get()).toBeNull();
});

it('expires a hanging refresh and ignores its late result without a permanent lock', async () => {
  vi.useFakeTimers();
  const refresh = deferred<Response>();
  let refreshes = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('/refresh')) {
        refreshes++;
        return refresh.promise;
      }
      return Promise.resolve(response(401));
    }),
  );
  try {
    const result = apiFetch('/one').catch((error) => error);
    await vi.advanceTimersByTimeAsync(1);
    expect(refreshes).toBe(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBeInstanceOf(Error);
    await tokenStore.set(b);
    refresh.resolve(response(200, rotated));
    await vi.advanceTimersByTimeAsync(1);
    expect(tokenStore.get()).toEqual(b);
  } finally {
    vi.useRealTimers();
  }
});
