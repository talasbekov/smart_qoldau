import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from './a11y';

test('смена языка сохраняет страницу каталога и фильтр', async ({ page }) => {
  await page.goto('/ru/catalog?format=video');
  await page.getByRole('link', { name: 'Қазақша', exact: true }).click();
  await expect(page).toHaveURL(/\/kz\/catalog\?format=video$/);
  await expect(page.getByLabel('Формат')).toHaveValue('video');
  await page.getByRole('link', { name: 'Русский', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/catalog\?format=video$/);
});

test('каталог приходит готовым из сервера, а не собирается скриптами', async ({ request }) => {
  const response = await request.get('/ru/catalog');

  expect(response.status()).toBe(200);
  // Ради этого весь эпик: поисковик видит содержимое без выполнения JS.
  expect(await response.text()).toContain('Найдите своего специалиста');
});

test('фильтр уходит в адрес и переживает перезагрузку', async ({ page }) => {
  await page.goto('/ru/catalog');

  await page.getByLabel('Формат').selectOption('video');
  await page.getByRole('button', { name: 'Показать' }).click();

  await expect(page).toHaveURL(/format=video/);
  // Выборку можно переслать: открытая заново страница помнит фильтр.
  await page.reload();
  await expect(page.getByLabel('Формат')).toHaveValue('video');
});

test('каталог доступен и не нарушает WCAG 2 AA', async ({ page }) => {
  await page.goto('/ru/catalog');
  await expectNoA11yViolations(page);
});

test('пустая выборка объясняется словами, а не пустотой', async ({ page }) => {
  // Тема существует, но специалистов по ней на стенде нет.
  await page.goto('/ru/catalog?topic=burnout&format=video&language=en');

  await expect(page.getByText('По заданным фильтрам специалисты не найдены')).toBeVisible();
});

test('экстренные службы доступны и на внутренней странице, не только на главной', async ({
  page,
}) => {
  // Человек приходит из поиска сразу в каталог или на профиль — на
  // главную с её дисклеймером он может вообще не попасть.
  await page.goto('/ru/catalog');

  const services = page.getByRole('navigation', { name: /Экстренные службы/ });
  await expect(services).toBeVisible();
  await expect(services.getByRole('link', { name: /112/ })).toHaveAttribute('href', 'tel:112');
});
