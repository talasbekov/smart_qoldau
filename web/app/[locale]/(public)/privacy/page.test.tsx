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
import PrivacyPage from './page';

describe('PrivacyPage', () => {
  it('показывает все 6 секций политики', async () => {
    currentMessages = ru;
    const ui = await PrivacyPage();
    render(
      <NextIntlClientProvider locale="ru" messages={ru}>
        {ui}
      </NextIntlClientProvider>,
    );
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(ru.privacy[`section${i}Title` as 'section1Title'])).toBeInTheDocument();
    }
  });
});
