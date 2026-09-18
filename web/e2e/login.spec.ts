import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from './a11y';

const SYNTHETIC_ACCESS_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJzeW50aGV0aWMtY2xpZW50In0.signature';

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

test('synthetic fixture: после 200 клиент попадает в локализованный кабинет', async ({ page }) => {
  await page.route('**/api/auth/request-code', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/verify-code', async (route) => {
    // Это не вход в стенд: cookie и ответ существуют только в тестовом
    // браузерном контексте, чтобы серверный кабинет мог принять navigation.
    await page.context().addCookies([
      {
        name: 'sq_at',
        value: SYNTHETIC_ACCESS_TOKEN,
        url: 'http://127.0.0.1:3100',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await route.fulfill({ status: 200, json: { user: { role: 'CLIENT' } } });
  });

  await page.goto('/ru/login');
  await page.getByLabel('Номер телефона').fill('+77010000000');
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из SMS').fill('123456');
  await page.getByRole('button', { name: 'Войти' }).click();

  await expect(page).toHaveURL(/\/ru\/profile$/);
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
});
