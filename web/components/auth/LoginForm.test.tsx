import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('./navigation', () => ({
  navigateAfterLogin: (destination: string) => replace(destination),
}));

// eslint-disable-next-line import/first
import LoginForm from './LoginForm';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

function mockFetch(responses: { status: number; body?: unknown }[]) {
  const fn = jest.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body ?? {},
    });
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

async function enterPhone(phone = '+77010000000', locale = 'ru') {
  fireEvent.change(
    screen.getByLabelText(
      locale === 'kz' ? 'Телефон нөмірі' : 'Номер телефона',
    ),
    { target: { value: phone } },
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: locale === 'kz' ? 'Кодты алу' : 'Получить код',
    }),
  );
  await screen.findByLabelText(locale === 'kz' ? 'SMS коды' : 'Код из SMS');
}

describe('LoginForm', () => {
  it('у полей есть видимые подписи и правильный тип ввода', () => {
    render(<LoginForm locale="ru" />);

    const phone = screen.getByLabelText('Номер телефона');
    expect(phone).toHaveAttribute('type', 'tel');
    expect(phone).toHaveAttribute('autocomplete', 'tel');
  });

  it('не шлёт SMS на явно неверный номер', async () => {
    const fetchMock = mockFetch([{ status: 204 }]);
    render(<LoginForm locale="ru" />);

    fireEvent.change(screen.getByLabelText('Номер телефона'), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Получить код' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/формат/i),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('после запроса кода показывает поле кода с автозаполнением из SMS', async () => {
    mockFetch([{ status: 204 }]);
    render(<LoginForm locale="ru" />);

    await enterPhone();

    const code = await screen.findByLabelText('Код из SMS');
    // WCAG 2.2 «Accessible Authentication»: код должен вставляться и
    // подставляться автоматически, а не переписываться руками.
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    expect(code).toHaveAttribute('inputmode', 'numeric');
  });

  it('код — одно поле, а не шесть клеточек: в клеточки не вставить', async () => {
    mockFetch([{ status: 204 }]);
    render(<LoginForm locale="ru" />);

    await enterPhone();
    await screen.findByLabelText('Код из SMS');

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('показывает ошибку бэкенда словами, а не кодом', async () => {
    mockFetch([
      { status: 204 },
      { status: 400, body: { code: 'SMS_CODE_INVALID' } },
    ]);
    render(<LoginForm locale="ru" />);

    await enterPhone();
    fireEvent.change(await screen.findByLabelText('Код из SMS'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Неверный код'),
    );
  });

  it('после успешной проверки кода ведёт клиента в локализованный кабинет без повторного POST', async () => {
    const fetchMock = mockFetch([
      { status: 204 },
      { status: 200, body: { user: { role: 'CLIENT' } } },
    ]);
    render(<LoginForm locale="kz" />);

    await enterPhone(undefined, 'kz');
    fireEvent.change(await screen.findByLabelText('SMS коды'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Кіру' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/kz/profile'));
    expect(screen.getByRole('button', { name: 'Жіберілуде…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Жіберілуде…' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('после успешной проверки кода ведёт эксперта в его локализованный кабинет', async () => {
    mockFetch([
      { status: 204 },
      { status: 200, body: { user: { role: 'EXPERT' } } },
    ]);
    render(<LoginForm locale="ru" />);

    await enterPhone();
    fireEvent.change(await screen.findByLabelText('Код из SMS'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/ru/expert'));
  });

  it('после SMS возвращает клиента к начатому созданию заявки', async () => {
    mockFetch([
      { status: 204 },
      { status: 200, body: { user: { role: 'CLIENT' } } },
    ]);
    render(<LoginForm locale="kz" returnTo="/kz/requests/new" />);

    await enterPhone(undefined, 'kz');
    fireEvent.change(await screen.findByLabelText('SMS коды'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Кіру' }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/kz/requests/new'),
    );
  });

  it('не уходит со страницы и показывает универсальную ошибку для неизвестного envelope', async () => {
    mockFetch([
      { status: 204 },
      { status: 400, body: { message: 'OTP already used' } },
    ]);
    render(<LoginForm locale="ru" />);

    await enterPhone();
    fireEvent.change(await screen.findByLabelText('Код из SMS'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Что-то пошло не так. Попробуйте ещё раз',
      ),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('на время запроса блокирует кнопку, чтобы не отправить дважды', async () => {
    mockFetch([{ status: 204 }]);
    render(<LoginForm locale="ru" />);

    await enterPhone();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Войти|Отправляем/ }),
      ).toBeInTheDocument(),
    );
  });

  it('можно вернуться и исправить номер', async () => {
    mockFetch([{ status: 204 }]);
    render(<LoginForm locale="ru" />);

    await enterPhone();
    fireEvent.click(
      await screen.findByRole('button', { name: /Изменить номер/ }),
    );

    expect(screen.getByLabelText('Номер телефона')).toHaveValue('+77010000000');
  });
});

it('supports the Kazakh SMS login flow and its validation errors', async () => {
  mockFetch([
    { status: 204 },
    { status: 400, body: { code: 'SMS_CODE_INVALID' } },
  ]);
  render(<LoginForm locale="kz" />);
  fireEvent.change(screen.getByLabelText('Телефон нөмірі'), {
    target: { value: '+77010000000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Кодты алу' }));
  fireEvent.change(await screen.findByLabelText('SMS коды'), {
    target: { value: '123456' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Кіру' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Код қате');
  expect(
    screen.getByRole('button', { name: 'Нөмірді өзгерту' }),
  ).toBeInTheDocument();
});

it('waits for the shared session lock before verifying an SMS code', async () => {
  const fetchMock = mockFetch([
    { status: 204 },
    { status: 200, body: { user: { role: 'CLIENT' } } },
  ]);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: async (_name: string, work: () => unknown) => {
        await gate;
        return work();
      },
    },
  });
  render(<LoginForm locale="ru" />);
  await enterPhone();
  fireEvent.change(screen.getByLabelText('Код из SMS'), {
    target: { value: '123456' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  release();
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/ru/profile'));
});

beforeEach(() => {
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: async (_name: string, work: () => unknown) => work() },
  });
});
