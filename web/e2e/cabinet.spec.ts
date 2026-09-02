import { test, expect } from '@playwright/test';

test('кабинет без сессии уводит на вход, а не показывает пустой каркас', async ({ page }) => {
  await page.goto('/ru/consultations');

  await expect(page).toHaveURL(/\/ru\/login/);
});

test('кабинет закрыт от индексации', async ({ request }) => {
  // Даже редирект не должен оставлять приватный раздел в выдаче.
  const response = await request.get('/ru/consultations', { maxRedirects: 0 });

  expect([302, 307, 308]).toContain(response.status());
});
