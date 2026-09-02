import { render, screen } from '@testing-library/react';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

let current: typeof ru = ru;
jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (current as Record<string, Record<string, string>>)[namespace] ?? {};
    return (key: string) => dict[key] ?? `${namespace}.${key}`;
  },
}));

// eslint-disable-next-line import/first
import EmergencyBar from './EmergencyBar';

async function renderBar(messages: typeof ru = ru) {
  current = messages;
  render(await EmergencyBar());
}

describe('EmergencyBar', () => {
  it.each([
    ['150', 'Телефон доверия'],
    ['103', 'Скорая помощь'],
    ['112', 'Единая служба спасения'],
  ])('номер %s — рабочая ссылка tel:, а не текст', async (number) => {
    await renderBar();

    const link = screen.getByRole('link', { name: new RegExp(number) });
    expect(link).toHaveAttribute('href', `tel:${number}`);
  });

  it('говорит, что платформа не заменяет экстренные службы', async () => {
    await renderBar();

    // Фраза вымывается первой при правках текста, а убирать её нельзя.
    expect(screen.getByText(/не заменяет экстренные службы/i)).toBeInTheDocument();
  });

  it('объявлен как дополнительная навигация с понятным именем', async () => {
    await renderBar();

    expect(screen.getByRole('navigation', { name: /экстренн/i })).toBeInTheDocument();
  });

  it.each([
    ['ru', ru],
    ['kz', kz],
  ])('в локали %s не печатает сырые ключи', async (_n, messages) => {
    await renderBar(messages as typeof ru);

    expect(screen.queryByText(/^emergency\./)).toBeNull();
  });
});
