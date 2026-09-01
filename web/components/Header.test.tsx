import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '../messages/ru.json';
import kz from '../messages/kz.json';

// `next-intl/server` использует условие экспорта "react-server" — Jest
// (jsdom) резолвит пакет как клиентский и getTranslations бросает
// "not supported in Client Components". Мокаем модуль, чтобы серверные
// компоненты (Header, Footer, страницы) можно было тестировать в Jest;
// в реальном рантайме Next.js подключается настоящая реализация.
let currentMessages: typeof ru = ru;

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (currentMessages as Record<string, Record<string, string>>)[namespace] ?? {};
    return (key: string) => dict[key] ?? key;
  },
}));

// eslint-disable-next-line import/first
import Header from './Header';

describe('Header', () => {
  it.each([
    ['ru', ru],
    ['kz', kz],
  ])('рендерится на локали %s без падения', async (locale, messages) => {
    currentMessages = messages;
    const ui = await Header();
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        {ui}
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('SmartQoldau')).toBeInTheDocument();
  });
});
