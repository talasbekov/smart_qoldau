import { test, expect } from '@playwright/test';

const SYNTHETIC_ACCESS_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJzeW50aGV0aWMtY2xpZW50In0.signature';

test.describe('главные CTA', () => {
  const localeCases = [
    ['ru', 'Мне нужна помощь', 'Найти специалиста'],
    ['kz', 'Маған көмек керек', 'Маман табу'],
  ] as const;

  for (const [locale, help, catalog] of localeCases) {
    test(`в ${locale} ведут в консультацию и локализованный каталог`, async ({ page }) => {
      await page.goto(`/${locale}`);

      await expect(page.getByRole('link', { name: help }).first()).toHaveAttribute(
        'href',
        `/${locale}/requests/new`,
      );
      await expect(page.getByRole('link', { name: catalog }).first()).toHaveAttribute(
        'href',
        `/${locale}/catalog`,
      );
    });
  }

  test('synthetic fixture: гость проходит SMS и продолжает создание заявки', async ({ page }) => {
    await page.route('**/api/auth/request-code', (route) => route.fulfill({ status: 204 }));
    await page.route('**/api/auth/verify-code', async (route) => {
      // Мок: это не вход в стенд. Cookie существует только в этом тестовом
      // контексте и нужна, чтобы серверный layout пропустил навигацию.
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

    await page.goto('/ru');
    await page.getByRole('link', { name: 'Мне нужна помощь' }).first().click();
    await expect(page).toHaveURL(/\/ru\/login\?returnTo=%2Fru%2Frequests%2Fnew$/);

    await page.getByLabel('Номер телефона').fill('+77010000000');
    await page.getByRole('button', { name: 'Получить код' }).click();
    await page.getByLabel('Код из SMS').fill('123456');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page).toHaveURL(/\/ru\/requests\/new$/);
  });

  test('synthetic fixture: авторизованный клиент сразу открывает заявку', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'sq_at',
        value: SYNTHETIC_ACCESS_TOKEN,
        url: 'http://127.0.0.1:3100',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    await page.goto('/kz');
    await page.getByRole('link', { name: 'Маған көмек керек' }).first().click();

    await expect(page).toHaveURL(/\/kz\/requests\/new$/);
  });
});
