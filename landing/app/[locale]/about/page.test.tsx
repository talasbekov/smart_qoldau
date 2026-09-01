import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '../../../messages/ru.json';
import kz from '../../../messages/kz.json';

let currentMessages: typeof ru = ru;

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (currentMessages as Record<string, Record<string, string>>)[namespace] ?? {};
    return (key: string) => dict[key] ?? key;
  },
}));

// eslint-disable-next-line import/first
import AboutPage from './page';

async function renderPage(messages: typeof ru) {
  currentMessages = messages;
  const ui = await AboutPage();
  render(
    <NextIntlClientProvider locale="ru" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('AboutPage', () => {
  it('показывает три факта прототипа', async () => {
    await renderPage(ru);

    expect(screen.getByText('1–2 мин')).toBeInTheDocument();
    expect(screen.getByText('Чат · Аудио · Видео')).toBeInTheDocument();
    expect(screen.getByText('Анонимно')).toBeInTheDocument();
  });

  it('принципы перечислены и ведут к поддержке', async () => {
    await renderPage(ru);

    expect(screen.getByText('Наши принципы')).toBeInTheDocument();
    expect(screen.getByText('Связаться с поддержкой')).toBeInTheDocument();
  });

  it('дисклеймер про экстренные службы на месте', async () => {
    await renderPage(ru);

    // Обещание «помощь, а не диагноз» — не украшение: платформа не
    // заменяет экстренные службы, и это должно быть сказано прямо.
    expect(screen.getByText(/не заменяем экстренные службы/i)).toBeInTheDocument();
  });

  it('казахская версия переведена, а не подставляет ключи', async () => {
    await renderPage(kz as unknown as typeof ru);

    expect(screen.queryByText('title')).not.toBeInTheDocument();
    expect(screen.getByText('Біздің қағидаттарымыз')).toBeInTheDocument();
  });
});
