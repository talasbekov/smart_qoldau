import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '../../../messages/ru.json';

let currentMessages: typeof ru = ru;

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (currentMessages as Record<string, Record<string, string>>)[namespace] ?? {};
    return (key: string) => dict[key] ?? key;
  },
}));

// eslint-disable-next-line import/first
import PremiumPage from './page';

describe('PremiumPage', () => {
  it('показывает и месячную, и годовую цену Р-08 (не устаревшую цену прототипа)', async () => {
    currentMessages = ru;
    const ui = await PremiumPage();
    render(
      <NextIntlClientProvider locale="ru" messages={ru}>
        {ui}
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('2 990 ₸')).toBeInTheDocument();
    expect(screen.getByText('23 900 ₸')).toBeInTheDocument();
    expect(screen.queryByText(/4 990/)).not.toBeInTheDocument();
  });
});
