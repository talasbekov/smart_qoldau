import { render, screen } from '@testing-library/react';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

let current: typeof ru = ru;

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict = (current as Record<string, Record<string, unknown>>)[namespace] ?? {};
    // Так же, как next-intl: отсутствующий ключ печатается сырым.
    return (key: string) => typeof dict[key] === 'string' ? dict[key] : `${namespace}.${key}`;
  },
}));

jest.mock('@/lib/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// eslint-disable-next-line import/first
import Footer from './Footer';

async function renderFooter(messages: typeof ru) {
  current = messages;
  render(await Footer());
}

describe('Footer', () => {
  it.each([
    ['ru', ru],
    ['kz', kz],
  ])('в локали %s не печатает сырые ключи вместо текста', async (_name, messages) => {
    await renderFooter(messages as typeof ru);

    // Ключ, просочившийся в разметку, выглядит как `footer.about` —
    // именно так подвал показывал ссылку «О нас».
    expect(screen.queryByText(/^footer\./)).toBeNull();
  });

  it('ведёт на страницу «О нас» переведённым текстом', async () => {
    await renderFooter(ru);

    const link = screen.getByRole('link', { name: 'О нас' });
    expect(link).toHaveAttribute('href', '/about');
  });
});
