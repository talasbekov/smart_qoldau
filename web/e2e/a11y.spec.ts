import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from './a11y';

test('главная не нарушает WCAG 2 AA', async ({ page }) => {
  await page.goto('/ru');
  await expectNoA11yViolations(page);
});

test('до основного содержимого можно дойти одним Tab', async ({ page }) => {
  await page.goto('/ru');
  await page.keyboard.press('Tab');

  await expect(page.getByRole('link', { name: /основному содержимому/i })).toBeFocused();
});

test('казахская версия так же доступна', async ({ page }) => {
  await page.goto('/kz');
  await expectNoA11yViolations(page);
});
