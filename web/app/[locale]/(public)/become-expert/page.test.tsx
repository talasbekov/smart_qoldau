import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '@/messages/ru.json';

let currentMessages: typeof ru = ru;

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (currentMessages as Record<string, Record<string, string>>)[namespace] ?? {};
    return (key: string) => dict[key] ?? key;
  },
}));

// eslint-disable-next-line import/first
import BecomeExpertPage from './page';

describe('BecomeExpertPage', () => {
  it('показывает требования к специалистам', async () => {
    currentMessages = ru;
    const ui = await BecomeExpertPage();
    render(
      <NextIntlClientProvider locale="ru" messages={ru}>
        {ui}
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(new RegExp(ru.becomeExpert.requirement1))).toBeInTheDocument();
  });
});
