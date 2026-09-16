import { render, screen } from '@testing-library/react';
import ru from '@/messages/ru.json';

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const dict =
      (ru as Record<string, Record<string, string>>)[namespace] ?? {};
    return (key: string) => dict[key] ?? key;
  },
}));
jest.mock('@/components/SupportForm', () => ({
  __esModule: true,
  default: () => <form aria-label="guest-support" />,
}));
jest.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

// eslint-disable-next-line import/first
import SupportPage from './page';

it('keeps the guest form primary and does not publish unverified contacts', async () => {
  render(await SupportPage());

  expect(
    screen.getByRole('form', { name: 'guest-support' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('+7 700 000 00 00')).toBeNull();
  expect(screen.queryByText('support@smartqoldau.kz')).toBeNull();
  expect(screen.getByRole('link', { name: 'Мои обращения' })).toHaveAttribute(
    'href',
    '/support/requests',
  );
});
