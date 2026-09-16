import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import type { components } from '@/lib/api/generated';
import type { Consultation } from './ConsultationList';
import BookingFlow from './BookingFlow';

const replace = jest.fn();
const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

const EXPERT: components['schemas']['ExpertPublicDto'] = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Айгуль С.',
  city: 'Алматы',
  experience: 'THREE_TO_FIVE',
  priceTiyn: 399000,
  languages: ['ru', 'kz'],
  formats: ['chat', 'video'],
  topicSlugs: ['anxiety-stress'],
  workStatus: 'ACCEPTING',
  ratingAvg: 4.9,
  ratingCount: 12,
  photoUrl: null,
  about: null,
};

const TOPICS: components['schemas']['TopicDto'][] = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'anxiety-stress',
    name: 'Тревога и стресс',
  },
];

const CARD = {
  id: '33333333-3333-4333-8333-333333333333',
  maskedPan: '**** 4242',
  brand: 'visa',
  holderName: 'A TEST',
};

const SLOT = '2026-09-17T04:00:00.000Z';

const CONSULTATION: Consultation = {
  id: '44444444-4444-4444-8444-444444444444',
  status: 'SCHEDULED',
  format: 'video',
  isEmergency: false,
  startedAt: '2026-09-16T04:00:00.000Z',
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: 'HELD',
  expert: EXPERT,
  reviewId: null,
};

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

function response(status: number, payload: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response);
}

type FetchHandler = (
  url: string,
  init: RequestInit,
) => Promise<Response | undefined>;

function initialData(handler?: FetchHandler) {
  const fetchMock = jest.fn(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      const handled = await handler?.(url, init);
      if (handled) return handled;
      if (url.endsWith(`/experts/${EXPERT.id}/slots`)) {
        return response(200, { items: [{ startAt: SLOT }] });
      }
      if (url.endsWith('/payment-methods')) return response(200, [CARD]);
      throw new Error(`Unexpected request: ${init.method ?? 'GET'} ${url}`);
    },
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function renderFlow(locale: 'ru' | 'kz' = 'ru', consultation?: Consultation) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'kz' ? kz : ru}
    >
      <BookingFlow
        expert={EXPERT}
        topics={TOPICS}
        locale={locale}
        consultation={consultation}
      />
    </NextIntlClientProvider>,
  );
}

describe('BookingFlow', () => {
  it('во время загрузки слотов сообщает статус и блокирует подтверждение', () => {
    global.fetch = jest.fn(() => new Promise<Response>(() => {})) as never;

    renderFlow();

    expect(screen.getByText('Загружаем доступное время…')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Подтвердить запись' }),
    ).toBeDisabled();
  });

  it('показывает слоты строго по Алматы, тему, формат, карту и условия холда', async () => {
    initialData();

    renderFlow();

    expect(
      await screen.findByRole('heading', { name: 'Запись к Айгуль С.' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/время указано по Алматы/i)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /17 сентября/i }),
    ).toBeEnabled();
    expect(screen.getByRole('radio', { name: '09:00' })).toBeChecked();
    expect(
      screen.getByRole('combobox', { name: 'Тема консультации' }),
    ).toHaveValue('anxiety-stress');
    expect(screen.getByRole('radio', { name: 'Видео' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /4242.*visa/i })).toBeChecked();
    expect(screen.getByText(/50 минут/i)).toBeInTheDocument();
    expect(screen.getByText(/сумма.*блокируется/i)).toBeInTheDocument();
    expect(screen.getByText('3 990 ₸')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Подтвердить запись' }),
    ).toBeEnabled();
  });

  it('показывает локализованное пустое состояние без ложной ошибки', async () => {
    initialData(async (url) => {
      if (url.includes('/slots')) return response(200, { items: [] });
      return undefined;
    });

    renderFlow('kz');

    expect(
      await screen.findByText('Алдағы 14 күнге бос уақыт жоқ.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Уақытты жаңарту' }),
    ).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ошибку загрузки объявляет и даёт повторить запрос', async () => {
    let attempts = 0;
    initialData(async (url) => {
      if (!url.includes('/slots')) return undefined;
      attempts += 1;
      if (attempts === 1) throw new TypeError('network down');
      return response(200, { items: [{ startAt: SLOT }] });
    });

    renderFlow();

    expect(
      await screen.findByRole('alert', { name: 'Не удалось загрузить время' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByRole('radio', { name: '09:00' })).toBeChecked();
    expect(attempts).toBe(2);
  });

  it('не создаёт запись без сохранённого способа оплаты', async () => {
    initialData(async (url) => {
      if (url.endsWith('/payment-methods')) return response(200, []);
      return undefined;
    });

    renderFlow();

    expect(
      await screen.findByText(/нет сохранённых способов оплаты/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Подтвердить запись' }),
    ).toBeDisabled();
  });

  it('создаёт бронь реальным payload и открывает подтверждённую консультацию', async () => {
    const fetchMock = initialData(async (url) => {
      if (url.endsWith('/bookings')) {
        return response(201, {
          consultationId: CONSULTATION.id,
          startedAt: SLOT,
          status: 'SCHEDULED',
          paymentStatus: 'HELD',
        });
      }
      return undefined;
    });
    renderFlow();
    await screen.findByRole('radio', { name: '09:00' });

    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/ru/consultations/${CONSULTATION.id}`,
      ),
    );
    const request = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/bookings'),
    );
    expect(request?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      expertId: EXPERT.id,
      topicSlug: 'anxiety-stress',
      format: 'video',
      slotStartAt: SLOT,
      paymentMethodId: CARD.id,
    });
  });

  it('двойной клик отправляет только одну бронь', async () => {
    let finish!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const fetchMock = initialData(async (url) => {
      if (url.endsWith('/bookings')) return pending;
      return undefined;
    });
    renderFlow();
    await screen.findByRole('radio', { name: '09:00' });
    const submit = screen.getByRole('button', { name: 'Подтвердить запись' });

    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/bookings')),
    ).toHaveLength(1);
    finish(
      await response(201, {
        consultationId: CONSULTATION.id,
        startedAt: SLOT,
        status: 'SCHEDULED',
        paymentStatus: 'HELD',
      }),
    );
  });

  it('конфликт слота сохраняет контекст и обновляет доступность', async () => {
    let slotLoads = 0;
    initialData(async (url) => {
      if (url.includes('/slots')) {
        slotLoads += 1;
        return response(200, {
          items: slotLoads === 1 ? [{ startAt: SLOT }] : [],
        });
      }
      if (url.endsWith('/bookings')) {
        return response(409, { error: { code: 'SLOT_TAKEN' } });
      }
      return undefined;
    });
    renderFlow();
    await screen.findByRole('radio', { name: '09:00' });

    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }));

    expect(
      await screen.findByRole('alert', { name: 'Это время уже заняли' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/свободных слотов нет/i),
    ).toBeInTheDocument();
    expect(slotLoads).toBe(2);
  });

  it('не разрешает повторную отправку, пока после конфликта обновляются слоты', async () => {
    let slotLoads = 0;
    let finishReload!: (value: Response) => void;
    const reload = new Promise<Response>((resolve) => {
      finishReload = resolve;
    });
    initialData(async (url) => {
      if (url.includes('/slots')) {
        slotLoads += 1;
        return slotLoads === 1
          ? response(200, { items: [{ startAt: SLOT }] })
          : reload;
      }
      if (url.endsWith('/bookings')) {
        return response(409, { error: { code: 'SLOT_TAKEN' } });
      }
      return undefined;
    });
    renderFlow();
    await screen.findByRole('radio', { name: '09:00' });

    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }));

    expect(
      await screen.findByRole('alert', { name: 'Это время уже заняли' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Подтвердить запись' }),
    ).toBeDisabled();
    finishReload(await response(200, { items: [] }));
    expect(
      await screen.findByText(/свободных слотов нет/i),
    ).toBeInTheDocument();
  });

  it('после сетевой неопределённости сначала сверяет результат и не повторяет POST', async () => {
    const fetchMock = initialData(async (url) => {
      if (url.endsWith('/bookings')) throw new TypeError('response lost');
      if (url.endsWith('/consultations?status=SCHEDULED&take=100')) {
        return response(200, [
          { ...CONSULTATION, startedAt: SLOT, expert: EXPERT },
        ]);
      }
      return undefined;
    });
    renderFlow();
    await screen.findByRole('radio', { name: '09:00' });

    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }));
    expect(
      await screen.findByRole('alert', { name: 'Результат записи неизвестен' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Проверить результат' }),
    );

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/ru/consultations/${CONSULTATION.id}`,
      ),
    );
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/bookings')),
    ).toHaveLength(1);
  });

  it('считает ответ 5xx неопределённым исходом мутации', async () => {
    initialData(async (url) => {
      if (url.endsWith('/bookings')) {
        return response(500, { error: { code: 'INTERNAL_ERROR' } });
      }
      return undefined;
    });
    renderFlow();
    await screen.findByRole('radio', { name: '09:00' });

    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }));

    expect(
      await screen.findByRole('alert', { name: 'Результат записи неизвестен' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Подтвердить запись' }),
    ).toBeDisabled();
  });

  it('перенос не запрашивает карту и отправляет только новый слот', async () => {
    const fetchMock = initialData(async (url) => {
      if (url.endsWith(`/consultations/${CONSULTATION.id}/reschedule`)) {
        return response(200, {
          consultationId: CONSULTATION.id,
          startedAt: SLOT,
          status: 'SCHEDULED',
          paymentStatus: 'HELD',
        });
      }
      return undefined;
    });
    renderFlow('ru', CONSULTATION);
    await screen.findByRole('radio', { name: '09:00' });

    expect(screen.queryByText(/способ оплаты/i)).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить перенос' }),
    );

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/ru/consultations/${CONSULTATION.id}`,
      ),
    );
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith('/payment-methods'),
      ),
    ).toBe(false);
    const request = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith(`/consultations/${CONSULTATION.id}/reschedule`),
    );
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      slotStartAt: SLOT,
    });
  });

  it('неопределённый перенос сверяет detail до разрешения повторной отправки', async () => {
    const fetchMock = initialData(async (url) => {
      if (url.endsWith(`/consultations/${CONSULTATION.id}/reschedule`)) {
        throw new TypeError('response lost');
      }
      if (url.endsWith(`/consultations/${CONSULTATION.id}`)) {
        return response(200, { ...CONSULTATION, startedAt: SLOT });
      }
      return undefined;
    });
    renderFlow('ru', CONSULTATION);
    await screen.findByRole('radio', { name: '09:00' });

    fireEvent.click(
      screen.getByRole('button', { name: 'Подтвердить перенос' }),
    );
    expect(
      await screen.findByRole('alert', {
        name: 'Результат переноса неизвестен',
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Проверить результат' }),
    );

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/ru/consultations/${CONSULTATION.id}`,
      ),
    );
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith(`/consultations/${CONSULTATION.id}/reschedule`),
      ),
    ).toHaveLength(1);
  });
});
