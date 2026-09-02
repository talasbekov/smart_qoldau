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

jest.mock('@/lib/api', () => ({
  fetchPublicExperts: jest.fn().mockResolvedValue([]),
}));

// eslint-disable-next-line import/first
import HomePage from './page';

describe('HomePage', () => {
  it('рендерится с пустой витриной специалистов', async () => {
    currentMessages = ru;
    const ui = await HomePage();
    render(
      <NextIntlClientProvider locale="ru" messages={ru}>
        {ui}
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(ru.home.heroTitle)).toBeInTheDocument();
    expect(screen.getByText(ru.home.specialistsEmpty)).toBeInTheDocument();
  });
});
