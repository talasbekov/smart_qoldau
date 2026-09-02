import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from './a11y';

const MISSING = '11111111-1111-1111-1111-111111111111';

test('несуществующий специалист отдаёт 404, а не пустую страницу', async ({ request }) => {
  const response = await request.get(`/ru/experts/${MISSING}`);

  // Пустая страница со статусом 200 попадёт в индекс как дубль.
  expect(response.status()).toBe(404);
});

test('каталог доступен из шапки и помечает себя текущим', async ({ page }) => {
  await page.goto('/ru');
  await page.getByRole('link', { name: 'Каталог' }).click();

  await expect(page).toHaveURL(/\/ru\/catalog/);
  await expect(page.getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page');
});

test('страница 404 тоже доступна с клавиатуры', async ({ page }) => {
  await page.goto(`/ru/experts/${MISSING}`);
  await expectNoA11yViolations(page);
});
