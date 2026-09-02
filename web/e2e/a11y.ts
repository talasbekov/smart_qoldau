import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Общий помощник для сквозных тестов. Лежит отдельно от .spec-файлов:
// импорт из файла с тестами заставил бы Playwright прогонять их дважды.
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

  expect(
    violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`),
    'нарушения доступности',
  ).toEqual([]);
}
