import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

let currentMessages: typeof ru = ru;

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (currentMessages as Record<string, Record<string, unknown>>)[namespace] ?? {};
    return (key: string) => typeof dict[key] === 'string' ? dict[key] : key;
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
    expect(screen.getByRole('heading', { level: 1, name: ru.home.heroTitle })).toBeInTheDocument();
    expect(screen.getByText(ru.home.specialistsEmpty)).toBeInTheDocument();
  });

  it.each([
    ['ru', ru],
    ['kz', kz],
  ])('ведёт из CTA %s в каталог или в создание заявки, а не в поддержку', async (_locale, messages) => {
    currentMessages = messages as typeof ru;
    const ui = await HomePage();
    render(
      <NextIntlClientProvider locale={_locale} messages={messages as typeof ru}>
        {ui}
      </NextIntlClientProvider>,
    );

    const catalogLinks = screen.getAllByRole('link', { name: messages.home.heroCtaCatalog });
    expect(catalogLinks).toHaveLength(2);
    catalogLinks.forEach((link) => expect(link).toHaveAttribute('href', `/${_locale}/catalog`));

    expect(screen.getByRole('link', { name: messages.home.heroCtaHelp })).toHaveAttribute(
      'href',
      `/${_locale}/requests/new`,
    );
    expect(screen.getByRole('link', { name: messages.home.urgentCta })).toHaveAttribute(
      'href',
      `/${_locale}/requests/new`,
    );
    expect(screen.getByRole('link', { name: messages.home.finalCtaHelp })).toHaveAttribute(
      'href',
      `/${_locale}/requests/new`,
    );
  });

  it.each([
    ['ru', ru],
    ['kz', kz],
  ])('ведёт из CTA материалов %s в локализованный раздел материалов', async (_locale, messages) => {
    currentMessages = messages as typeof ru;
    const ui = await HomePage();
    render(
      <NextIntlClientProvider locale={_locale} messages={messages as typeof ru}>
        {ui}
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole('link', { name: messages.home.materialsAll })).toHaveAttribute(
      'href',
      `/${_locale}/materials`,
    );
  });
});
