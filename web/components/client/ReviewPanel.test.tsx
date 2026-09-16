import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReviewPanel from './ReviewPanel';
import type { Consultation } from './ConsultationList';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

const CONSULTATION = {
  id: 'c1',
  status: 'COMPLETED',
  outcome: 'COMPLETED',
  format: 'video',
  isEmergency: false,
  startedAt: '2026-09-16T10:00:00.000Z',
  endedAt: '2026-09-16T10:50:00.000Z',
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: 'CAPTURED',
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
} satisfies Consultation;

function response(status: number, payload: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response);
}

function fetchMock(
  handler: (url: string, init: RequestInit) => Promise<Response>,
) {
  const fn = jest.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
    handler(String(input), init),
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('ReviewPanel', () => {
  it('показывает доступную форму только после состоявшейся консультации', () => {
    const { rerender } = render(
      <ReviewPanel consultation={CONSULTATION} locale="ru" />,
    );

    expect(
      screen.getByRole('heading', { name: 'Как прошла консультация?' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /из 5/ })).toHaveLength(5);
    expect(screen.getByLabelText('Публичный отзыв')).toHaveAttribute(
      'maxLength',
      '2000',
    );
    expect(screen.getByLabelText('Приватно команде качества')).toHaveAttribute(
      'maxLength',
      '2000',
    );

    rerender(
      <ReviewPanel
        consultation={{ ...CONSULTATION, outcome: 'CLIENT_NO_SHOW' } as never}
        locale="ru"
      />,
    );
    expect(
      screen.queryByRole('heading', { name: 'Как прошла консультация?' }),
    ).toBeNull();
  });

  it('отправляет выбранную оценку, допустимые теги и непустые тексты', async () => {
    const mock = fetchMock(async () =>
      response(201, {
        id: 'r1',
        consultationId: 'c1',
        rating: 4,
        publicText: 'Помогло разобраться',
        tags: ['professional'],
        createdAt: '2026-09-16T11:00:00.000Z',
      }),
    );
    render(<ReviewPanel consultation={CONSULTATION} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /4 из 5.*Хорошо/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Профессионально' }));
    fireEvent.change(screen.getByLabelText('Публичный отзыв'), {
      target: { value: '  Помогло разобраться  ' },
    });
    fireEvent.change(screen.getByLabelText('Приватно команде качества'), {
      target: { value: '  Только для команды  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    await screen.findByRole('heading', { name: 'Спасибо за отзыв' });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0]).toBe('/api/proxy/consultations/c1/review');
    expect(
      JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string),
    ).toEqual({
      rating: 4,
      publicText: 'Помогло разобраться',
      privateText: 'Только для команды',
      tags: ['professional'],
    });
    expect(screen.getByText('Помогло разобраться')).toBeInTheDocument();
    expect(screen.getByText('Профессионально')).toBeInTheDocument();
    expect(screen.queryByText('Только для команды')).toBeNull();
    expect(
      screen.getByText(/приватный комментарий передан команде качества/i),
    ).toBeInTheDocument();
  });

  it('не отправляет второй POST при двойном нажатии', async () => {
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const mock = fetchMock(() => pending);
    render(<ReviewPanel consultation={CONSULTATION} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /5 из 5.*Отлично/ }));
    const submit = screen.getByRole('button', { name: 'Отправить отзыв' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Отправляем…' })).toBeDisabled();

    finish(
      await response(201, {
        id: 'r1',
        consultationId: 'c1',
        rating: 5,
        publicText: null,
        tags: [],
        createdAt: '2026-09-16T11:00:00.000Z',
      }),
    );
    await screen.findByRole('heading', { name: 'Спасибо за отзыв' });
  });

  it('блокирует оба текста во время запроса и сохраняет исходный черновик после ошибки', async () => {
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    fetchMock(() => pending);
    render(<ReviewPanel consultation={CONSULTATION} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /4 из 5.*Хорошо/ }));
    const publicText = screen.getByLabelText('Публичный отзыв');
    const privateText = screen.getByLabelText('Приватно команде качества');
    fireEvent.change(publicText, { target: { value: 'Публичный черновик' } });
    fireEvent.change(privateText, { target: { value: 'Приватный черновик' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    expect(publicText).toBeDisabled();
    expect(privateText).toBeDisabled();

    finish(
      await response(400, {
        error: { code: 'REVIEW_TAG_NOT_ALLOWED', message: 'Неверный тег' },
      }),
    );

    await screen.findByText(/не удалось сохранить отзыв/i);
    expect(publicText).toBeEnabled();
    expect(privateText).toBeEnabled();
    expect(publicText).toHaveValue('Публичный черновик');
    expect(privateText).toHaveValue('Приватный черновик');
  });

  it('показывает already-submitted из consultation и из REVIEW_EXISTS', async () => {
    const first = render(
      <ReviewPanel
        consultation={{ ...CONSULTATION, reviewId: 'r-existing' } as never}
        locale="ru"
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Вы уже оценили эту консультацию',
      }),
    ).toBeInTheDocument();
    first.unmount();

    fetchMock(async () =>
      response(409, {
        error: { code: 'REVIEW_EXISTS', message: 'Отзыв уже оставлен' },
      }),
    );
    render(<ReviewPanel consultation={CONSULTATION} locale="ru" />);
    fireEvent.click(screen.getByRole('button', { name: /5 из 5.*Отлично/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Вы уже оценили эту консультацию',
      }),
    ).toBeInTheDocument();
  });

  it('после неизвестного исхода сверяет консультацию до разрешения повтора', async () => {
    const mock = fetchMock(async (url, init) => {
      if (init.method === 'POST') throw new TypeError('connection lost');
      if (url.endsWith('/consultations/c1')) {
        return response(200, { ...CONSULTATION, reviewId: 'r-saved' });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<ReviewPanel consultation={CONSULTATION} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /5 из 5.*Отлично/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    expect(
      await screen.findByText(/не удалось подтвердить, сохранился ли отзыв/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Отправить отзыв' }),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Проверить отзыв' }));
    expect(
      await screen.findByRole('heading', {
        name: 'Вы уже оценили эту консультацию',
      }),
    ).toBeInTheDocument();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('не разрешает повтор, если контрольный ответ не подтверждает reviewId', async () => {
    fetchMock(async (_url, init) => {
      if (init.method === 'POST') throw new TypeError('connection lost');
      return response(204, null);
    });
    render(<ReviewPanel consultation={CONSULTATION} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /5 из 5.*Отлично/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));
    await screen.findByText(/не удалось подтвердить, сохранился ли отзыв/i);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить отзыв' }));

    expect(
      await screen.findByText(/пока не удалось проверить отзыв/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Отправить отзыв' }),
    ).toBeNull();
  });

  it('при подтверждённом отказе сохраняет ввод и разрешает повтор', async () => {
    fetchMock(async () =>
      response(400, {
        error: { code: 'REVIEW_TAG_NOT_ALLOWED', message: 'Неверный тег' },
      }),
    );
    render(<ReviewPanel consultation={CONSULTATION} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /4 из 5.*Хорошо/ }));
    fireEvent.change(screen.getByLabelText('Публичный отзыв'), {
      target: { value: 'Мой текст' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить отзыв' }));

    expect(
      await screen.findByText(/не удалось сохранить отзыв/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Публичный отзыв')).toHaveValue('Мой текст');
    expect(
      screen.getByRole('button', { name: 'Отправить отзыв' }),
    ).toBeEnabled();
  });

  it('локализует весь review flow на казахский', () => {
    render(<ReviewPanel consultation={CONSULTATION} locale="kz" />);

    expect(
      screen.getByRole('heading', { name: 'Кеңес қалай өтті?' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Ашық пікір')).toBeInTheDocument();
    expect(screen.getByLabelText('Сапа тобына жеке')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Пікірді жіберу' }),
    ).toBeDisabled();
  });

  it('смена оценки сбрасывает теги прежней оценки', async () => {
    render(<ReviewPanel consultation={CONSULTATION} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /4 из 5.*Хорошо/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Профессионально' }));
    expect(
      screen.getByRole('button', { name: 'Профессионально' }),
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /1 из 5.*Плохо/ }));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Профессионально' }),
      ).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Не помогло' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
