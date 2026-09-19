import { test, expect, type BrowserContext } from '@playwright/test';

// UI-only fixtures: these tokens cannot authenticate with Nest. The test
// exercises middleware, cookies, Web Locks and navigation, not SMS delivery.
const token = (expiresIn: number) =>
  `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({
    sub: 'synthetic-renewal-client',
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  })).toString('base64url')}.signature`;

async function expiredSession(context: BrowserContext) {
  await context.addCookies([
    { name: 'sq_at', value: token(-60), url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Lax' },
    { name: 'sq_rt', value: 'synthetic-refresh-only', url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Lax' },
  ]);
}

test('synthetic fixture: expired session renews once across two tabs and returns to the requested page', async ({ context }) => {
  await expiredSession(context);
  let rotations = 0;
  await context.route('**/api/auth/refresh', async (route) => {
    rotations++;
    // Keep the first response pending until both tabs entered renewal;
    // otherwise this could pass with two sequential navigations.
    await expect.poll(() => [one, two].filter((page) => page.url().includes('/renew-session')).length).toBe(2);
    await context.addCookies([
      { name: 'sq_at', value: token(900), url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Lax' },
    ]);
    await route.fulfill({ json: { user: { id: 'synthetic-renewal-client' }, expiresAt: Date.now() + 900_000 } });
  });
  const one = await context.newPage();
  const two = await context.newPage();
  await Promise.all([one.goto('/ru/profile'), two.goto('/ru/favorites')]);
  await expect(one).toHaveURL(/\/ru\/profile$/);
  await expect(two).toHaveURL(/\/ru\/favorites$/);
  await expect(one.getByRole('heading', { name: 'Профиль', exact: true })).toBeVisible();
  await expect(two.getByRole('heading', { name: 'Избранное', exact: true })).toBeVisible();
  expect(rotations).toBe(1);
  expect(await one.evaluate(() => document.cookie)).not.toMatch(/sq_at|sq_rt/);
});

test('expired session does not block the public homepage', async ({ context, page }) => {
  await expiredSession(context);
  await page.goto('/ru');
  await expect(page).toHaveURL(/\/ru$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('synthetic fixture: renewal failure is visible and does not loop', async ({ context, page }) => {
  await expiredSession(context);
  let rotations = 0;
  await context.route('**/api/auth/refresh', async (route) => {
    rotations++;
    await route.fulfill({ status: 503, json: { code: 'SESSION_UNAVAILABLE' } });
  });
  await page.goto('/kz/profile');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Кіру', exact: true })).toBeVisible();
  expect(rotations).toBe(1);
});
