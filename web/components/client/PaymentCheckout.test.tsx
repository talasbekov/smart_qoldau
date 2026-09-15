import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const replace = jest.fn();
const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

// eslint-disable-next-line import/first
import PaymentCheckout from './PaymentCheckout';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
  jest.useRealTimers();
});

const CONSULTATION = {
  id: 'c1',
  status: 'ACTIVE',
  outcome: null,
  format: 'video',
  isEmergency: false,
  startedAt: '2026-09-16T10:00:00.000Z',
  endedAt: null,
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: 'UNPAID',
  expert: {
    id: 'e1',
    displayName: 'Айгуль С.',
    city: 'Алматы',
    experience: 'THREE_TO_FIVE',
    priceTiyn: 399000,
    languages: ['ru'],
    formats: ['video'],
    topicSlugs: [],
    workStatus: 'ACCEPTING',
    ratingAvg: 4.9,
    ratingCount: 12,
    photoUrl: null,
    about: null,
  },
  reviewId: null,
} as never;

const CARD = {
  id: 'pm-1',
  maskedPan: '**** 4242',
  brand: 'visa',
  holderName: 'A TEST',
};

function response(status: number, payload: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response);
}

type FetchHandler = (url: string, init: RequestInit) => Promise<Response>;

function mockFetch(handler: FetchHandler) {
  const fn = jest.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
    handler(String(input), init),
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function renderCheckout(locale: 'ru' | 'kz' = 'ru') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'kz' ? kz : ru}
    >
      <PaymentCheckout consultation={CONSULTATION} locale={locale} />
    </NextIntlClientProvider>,
  );
}

function initialData(
  handler?: (url: string, init: RequestInit) => Promise<Response>,
) {
  return mockFetch(async (url, init) => {
    if (handler) {
      const handled = await handler(url, init);
      if (handled) return handled;
    }
    if (url.endsWith('/payment-methods')) return response(200, [CARD]);
    if (url.endsWith('/consultations/c1/payment')) {
      return response(404, { code: 'PAYMENT_NOT_FOUND' });
    }
    throw new Error(`Unexpected request: ${init.method ?? 'GET'} ${url}`);
  });
}

describe('PaymentCheckout', () => {
  it('пока данные загружаются, показывает статус и не разрешает оплату', () => {
    mockFetch(() => new Promise<Response>(() => {}));
    renderCheckout();

    expect(screen.getByText('Загружаем способы оплаты')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Проверяем оплату…' }),
    ).toBeDisabled();
  });

  it('показывает цену, длительность, условия холда и сохранённую карту', async () => {
    initialData();
    renderCheckout();

    expect(
      screen.getByRole('heading', { name: 'Оплата консультации' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 990 ₸')).toBeInTheDocument();
    expect(screen.getByText(/50 минут/)).toBeInTheDocument();
    expect(
      screen.getByText(/замораживается.*списывается только.*состоялась/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('radio', { name: /4242.*visa/i }),
    ).toBeChecked();
    expect(screen.getByRole('button', { name: 'Оплатить' })).toBeEnabled();
  });

  it('пустое состояние не собирает реквизиты карты и предлагает обновить список', async () => {
    mockFetch(async (url) => {
      if (url.endsWith('/payment-methods')) return response(200, []);
      return response(404, { code: 'PAYMENT_NOT_FOUND' });
    });
    renderCheckout();

    expect(
      await screen.findByText(/нет сохранённых способов оплаты/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/мобильном приложении/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/номер карты/i)).toBeNull();
    expect(
      screen.getByRole('button', { name: /обновить способы/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Оплатить' })).toBeDisabled();
  });

  it('ошибка загрузки способов оставляет понятный retry', async () => {
    mockFetch(async (url) => {
      if (url.endsWith('/payment-methods')) throw new TypeError('network down');
      return response(404, { code: 'PAYMENT_NOT_FOUND' });
    });
    renderCheckout();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /не удалось загрузить способы оплаты/i,
    );
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeEnabled();
  });

  it('блокирует двойную отправку, пока запрос холда выполняется', async () => {
    let release!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchMock = initialData(async (url, init) => {
      if (url.endsWith('/consultations/c1/pay') && init.method === 'POST')
        return pending;
      return undefined as never;
    });
    renderCheckout();
    await screen.findByRole('radio', { name: /4242/i });

    const button = screen.getByRole('button', { name: 'Оплатить' });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /проверяем оплату/i }),
      ).toBeDisabled(),
    );
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          String(url).endsWith('/consultations/c1/pay') &&
          init?.method === 'POST',
      ),
    ).toHaveLength(1);

    release(await response(200, { status: 'HELD' }));
  });

  it('после подтверждённого HELD заменяет маршрут на консультацию', async () => {
    initialData(async (url, init) => {
      if (url.endsWith('/consultations/c1/pay') && init.method === 'POST') {
        return response(200, { status: 'HELD' });
      }
      return undefined as never;
    });
    renderCheckout();
    await screen.findByRole('radio', { name: /4242/i });

    fireEvent.click(screen.getByRole('button', { name: 'Оплатить' }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/ru/consultations/c1'),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('показывает подтверждённый отказ провайдера и разрешает повторить', async () => {
    initialData(async (url, init) => {
      if (url.endsWith('/consultations/c1/pay') && init.method === 'POST') {
        return response(402, { code: 'PROVIDER_DECLINED' });
      }
      return undefined as never;
    });
    renderCheckout();
    await screen.findByRole('radio', { name: /4242/i });

    fireEvent.click(screen.getByRole('button', { name: 'Оплатить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /платёж отклонён/i,
    );
    expect(
      screen.getByRole('button', { name: /повторить оплату/i }),
    ).toBeEnabled();
  });

  it('при удалённом способе объясняет ошибку и перечитывает список карт', async () => {
    let methodReads = 0;
    const replacement = { ...CARD, id: 'pm-2', maskedPan: '**** 1111' };
    initialData(async (url, init) => {
      if (url.endsWith('/payment-methods')) {
        methodReads += 1;
        return response(200, methodReads === 1 ? [CARD] : [replacement]);
      }
      if (url.endsWith('/consultations/c1/pay') && init.method === 'POST') {
        return response(404, { code: 'PAYMENT_METHOD_NOT_FOUND' });
      }
      return undefined as never;
    });
    renderCheckout();
    await screen.findByRole('radio', { name: /4242/i });

    fireEvent.click(screen.getByRole('button', { name: 'Оплатить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /больше недоступен/i,
    );
    expect(await screen.findByRole('radio', { name: /1111/i })).toBeChecked();
    expect(methodReads).toBe(2);
  });

  it('на ALREADY_PAID сначала сверяет GET и только после HELD открывает консультацию', async () => {
    let statusReads = 0;
    initialData(async (url, init) => {
      if (url.endsWith('/consultations/c1/payment')) {
        statusReads += 1;
        return statusReads === 1
          ? response(404, { code: 'PAYMENT_NOT_FOUND' })
          : response(200, {
              status: 'HELD',
              amountTiyn: 399000,
              maskedPan: '**** 4242',
            });
      }
      if (url.endsWith('/consultations/c1/pay') && init.method === 'POST') {
        return response(409, { code: 'ALREADY_PAID' });
      }
      return undefined as never;
    });
    renderCheckout();
    await screen.findByRole('radio', { name: /4242/i });

    fireEvent.click(screen.getByRole('button', { name: 'Оплатить' }));

    await waitFor(() => expect(statusReads).toBe(2));
    expect(replace).toHaveBeenCalledWith('/ru/consultations/c1');
  });

  it('после неопределённого ответа не показывает успех и восстанавливается через проверку', async () => {
    let statusReads = 0;
    initialData(async (url, init) => {
      if (url.endsWith('/consultations/c1/payment')) {
        statusReads += 1;
        if (statusReads === 1)
          return response(404, { code: 'PAYMENT_NOT_FOUND' });
        if (statusReads === 2) throw new TypeError('network down');
        return response(200, {
          status: 'HELD',
          amountTiyn: 399000,
          maskedPan: '**** 4242',
        });
      }
      if (url.endsWith('/consultations/c1/pay') && init.method === 'POST') {
        throw new TypeError('connection reset');
      }
      return undefined as never;
    });
    renderCheckout();
    await screen.findByRole('radio', { name: /4242/i });

    fireEvent.click(screen.getByRole('button', { name: 'Оплатить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /не удалось подтвердить статус/i,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /проверить статус/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /проверить статус/i }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/ru/consultations/c1'),
    );
  });

  it('после reload ждёт PENDING и автоматически открывает консультацию лишь при HELD', async () => {
    jest.useFakeTimers();
    let statusReads = 0;
    initialData(async (url) => {
      if (url.endsWith('/consultations/c1/payment')) {
        statusReads += 1;
        return statusReads === 1
          ? response(200, {
              status: 'PENDING',
              amountTiyn: 399000,
              maskedPan: '**** 4242',
            })
          : response(200, {
              status: 'HELD',
              amountTiyn: 399000,
              maskedPan: '**** 4242',
            });
      }
      return undefined as never;
    });
    renderCheckout();

    expect(await screen.findByRole('status')).toHaveTextContent(
      /банк подтверждает/i,
    );
    expect(replace).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/ru/consultations/c1'),
    );
  });

  it('CAPTURED не считает разрешением live-сессии', async () => {
    initialData(async (url) => {
      if (url.endsWith('/consultations/c1/payment')) {
        return response(200, {
          status: 'CAPTURED',
          amountTiyn: 399000,
          maskedPan: '**** 4242',
        });
      }
      return undefined as never;
    });
    renderCheckout();

    expect(await screen.findByRole('status')).toHaveTextContent(/уже списана/i);
    expect(replace).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: /вернуться к консультации/i }),
    ).toHaveAttribute('href', '/ru/consultations/c1');
  });

  it('использует казахские тексты checkout', async () => {
    initialData();
    renderCheckout('kz');

    expect(
      screen.getByRole('heading', { name: 'Кеңес ақысын төлеу' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Төлеу' })).toBeEnabled();
  });
});
