import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '@/messages/ru.json';

let currentMessages: typeof ru = ru;

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (currentMessages as Record<string, Record<string, unknown>>)[namespace] ?? {};
    return (key: string) => typeof dict[key] === 'string' ? dict[key] : key;
  },
}));

// eslint-disable-next-line import/first
import TermsPage from './page';

describe('TermsPage', () => {
  it('показывает все 6 секций соглашения', async () => {
    currentMessages = ru;
    const ui = await TermsPage();
    render(
      <NextIntlClientProvider locale="ru" messages={ru}>
        {ui}
      </NextIntlClientProvider>,
    );
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(ru.terms[`section${i}Title` as 'section1Title'])).toBeInTheDocument();
    }
  });
});
