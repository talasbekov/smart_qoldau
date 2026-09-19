import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '@/messages/ru.json';

const currentMessages: typeof ru = ru;

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (currentMessages as Record<string, Record<string, unknown>>)[namespace] ?? {};
    return (key: string) => typeof dict[key] === 'string' ? dict[key] : key;
  },
}));

const getPremiumPlans = jest.fn();
jest.mock('@/lib/api/public', () => ({
  getPremiumPlans: () => getPremiumPlans(),
}));

// eslint-disable-next-line import/first
import PremiumPage from './page';

async function renderPage() {
  const ui = await PremiumPage();
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      {ui}
    </NextIntlClientProvider>,
  );
}

afterEach(() => jest.clearAllMocks());

describe('PremiumPage', () => {
  it('показывает цены из API, а не из файлов перевода', async () => {
    getPremiumPlans.mockResolvedValue({
      plans: [
        { plan: 'MONTH', priceTiyn: 499_000, periodDays: 30 },
        { plan: 'YEAR', priceTiyn: 3_990_000, periodDays: 365 },
      ],
      discountPercent: 10,
    });

    await renderPage();

    // Цена — свойство продукта, а не текст перевода: иначе в казахской
    // локали она может отличаться от русской, и никто этого не заметит.
    expect(screen.getByText(/4 990 ₸/)).toBeInTheDocument();
    expect(screen.getByText(/39 900 ₸/)).toBeInTheDocument();
  });

  it('переживает недоступный бэкенд и показывает запасную цену', async () => {
    getPremiumPlans.mockResolvedValue(null);

    await renderPage();

    // Страница тарифов не должна падать целиком из-за бэкенда: цены
    // берутся из перевода как запасной вариант.
    expect(screen.getAllByText(/₸/).length).toBeGreaterThan(0);
  });
});
