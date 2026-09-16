import { render, screen } from '@testing-library/react';

const authorizedFetch = jest.fn();
jest.mock('@/lib/api/authorized', () => ({
  authorizedFetch: (...args: unknown[]) => authorizedFetch(...args),
}));
jest.mock('next/navigation', () => ({ notFound: jest.fn() }));
jest.mock('@/components/client/Session', () => ({
  __esModule: true,
  default: ({
    locale,
    senderRole,
  }: {
    locale: string;
    senderRole?: string;
  }) => (
    <div
      data-testid="session"
      data-locale={locale}
      data-sender-role={senderRole}
    />
  ),
}));
jest.mock('@/components/client/Chat', () => ({
  __esModule: true,
  default: ({
    readOnly,
    locale,
    senderRole,
  }: {
    readOnly?: boolean;
    locale?: string;
    senderRole?: string;
  }) => (
    <div
      data-testid="chat"
      data-read-only={readOnly ? 'true' : 'false'}
      data-locale={locale}
      data-sender-role={senderRole}
    />
  ),
}));
jest.mock('@/components/expert-cabinet/ExpertSessionActions', () => ({
  __esModule: true,
  default: ({ active, locale }: { active: boolean; locale: string }) => (
    <div
      data-testid="expert-actions"
      data-active={active ? 'true' : 'false'}
      data-locale={locale}
    />
  ),
}));
jest.mock('@/components/expert-cabinet/ConsultationStatusRefresh', () => ({
  __esModule: true,
  default: () => <div data-testid="status-refresh" />,
}));

// eslint-disable-next-line import/first
import ExpertConsultationPage from './page';

function consultation(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    status: 'ACTIVE',
    outcome: null,
    format: 'video',
    clientCode: 'ABCD-1234',
    paymentStatus: 'HELD',
    ...over,
  };
}

async function renderPage(locale = 'ru') {
  render(
    await ExpertConsultationPage({
      params: Promise.resolve({ locale, id: 'c1' }),
    }),
  );
}

afterEach(() => jest.clearAllMocks());

describe('ExpertConsultationPage', () => {
  it('ACTIVE + HELD открывает звонок и только экспертский complete/note workflow', async () => {
    authorizedFetch.mockResolvedValue(consultation());

    await renderPage('kz');

    expect(screen.getByTestId('session')).toHaveAttribute('data-locale', 'kz');
    expect(screen.getByTestId('session')).toHaveAttribute(
      'data-sender-role',
      'expert',
    );
    expect(screen.getByTestId('expert-actions')).toHaveAttribute(
      'data-active',
      'true',
    );
    expect(screen.getByTestId('expert-actions')).toHaveAttribute(
      'data-locale',
      'kz',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Кеңес · клиент №ABCD-1234',
    );
    expect(screen.getByText('Қазір өтіп жатыр')).toBeInTheDocument();
  });

  it('ACTIVE без HELD не монтирует live и оставляет историю read-only', async () => {
    authorizedFetch.mockResolvedValue(
      consultation({ paymentStatus: 'UNPAID' }),
    );

    await renderPage();

    expect(screen.queryByTestId('session')).toBeNull();
    expect(screen.getByTestId('chat')).toHaveAttribute(
      'data-read-only',
      'true',
    );
    expect(screen.getByTestId('chat')).toHaveAttribute(
      'data-sender-role',
      'expert',
    );
    expect(screen.getByTestId('chat')).toHaveAttribute('data-locale', 'ru');
    expect(screen.getByRole('status')).toHaveTextContent(
      /без подтверждённого холда/i,
    );
    expect(screen.getByTestId('expert-actions')).toHaveAttribute(
      'data-active',
      'true',
    );
  });

  it('завершённая консультация хранит read-only историю и не повторяет outcome', async () => {
    authorizedFetch.mockResolvedValue(
      consultation({ status: 'COMPLETED', paymentStatus: 'CAPTURED' }),
    );

    await renderPage();

    expect(screen.getByTestId('chat')).toHaveAttribute(
      'data-read-only',
      'true',
    );
    expect(screen.getByTestId('expert-actions')).toHaveAttribute(
      'data-active',
      'false',
    );
  });

  it('запланированная консультация монтирует проверку перехода в ACTIVE', async () => {
    authorizedFetch.mockResolvedValue(
      consultation({ status: 'SCHEDULED', paymentStatus: 'HELD' }),
    );

    await renderPage();

    expect(screen.getByTestId('status-refresh')).toBeInTheDocument();
  });
});
