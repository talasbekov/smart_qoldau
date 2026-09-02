import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from './a11y';

test('страница входа доступна', async ({ page }) => {
  await page.goto('/ru/login');
  await expectNoA11yViolations(page);
});

test('вход не индексируется: в выдаче ему делать нечего', async ({ request }) => {
  const html = await (await request.get('/ru/login')).text();

  expect(html).toContain('noindex');
});

test('токены не попадают в браузер: cookie недоступны скриптам', async ({ page }) => {
  await page.goto('/ru/login');

  // Даже до входа проверяем инвариант: ни одна наша cookie не читается
  // из document.cookie. После входа это защищает переписку с психологом.
  const visible = await page.evaluate(() => document.cookie);
  expect(visible).not.toContain('sq_at');
  expect(visible).not.toContain('sq_rt');
});
