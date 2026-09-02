import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from './a11y';

test('материалы приходят готовыми из сервера — ради этого страница и публичная', async ({
  request,
}) => {
  const response = await request.get('/ru/materials');

  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('Материалы');
});

test('фильтр по виду живёт в адресе', async ({ page }) => {
  await page.goto('/ru/materials');
  await page.getByRole('link', { name: 'Медитации' }).click();

  await expect(page).toHaveURL(/kind=MEDITATION/);
});

test('раздел материалов доступен и не нарушает WCAG 2 AA', async ({ page }) => {
  await page.goto('/ru/materials');
  await expectNoA11yViolations(page);
});
