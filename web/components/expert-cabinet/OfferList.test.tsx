import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

const apiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: jest.requireActual('@/lib/api/client').ApiError,
}));
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const handlers: Record<string, (p: unknown) => void> = {};
let readyHandler: ((payload: unknown) => void) | undefined;
jest.mock('@/lib/realtime/socket', () => ({
  connectRealtime: async () => ({
    on: (event: string, handler: (p: unknown) => void) => {
      handlers[event] = handler;
      return () => delete handlers[event];
    },
    onReady: (handler: (payload: unknown) => void) => {
      readyHandler = handler;
      return () => {
        readyHandler = undefined;
      };
    },
    send: () => {},
    close: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import OfferList from './OfferList';
import { ApiError } from '@/lib/api/client';

const soon = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 1000).toISOString();

const offer = (over: Record<string, unknown> = {}) => ({
  offerId: 'o1',
  topicSlug: 'burnout',
  format: 'video',
  isEmergency: false,
  clientCode: 4831,
  deadlineAt: soon(),
  ...over,
});

const TOPICS = [{ id: '1', slug: 'burnout', name: 'Выгорание' }];

afterEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(handlers)) delete handlers[k];
  readyHandler = undefined;
});

describe('OfferList', () => {
  it('пусто — так и говорит', () => {
    render(<OfferList initial={[]} topics={TOPICS} locale="ru" />);

    expect(screen.getByText(/новых заявок нет/i)).toBeInTheDocument();
  });

  it('показывает тему словами, а не слагом', () => {
    render(<OfferList initial={[offer()]} topics={TOPICS} locale="ru" />);

    expect(screen.getByText('Выгорание')).toBeInTheDocument();
  });

  it('показывает код клиента, а не имя', () => {
    render(<OfferList initial={[offer()]} topics={TOPICS} locale="ru" />);

    // PII-инвариант: до консультации эксперт не знает, кто перед ним.
    expect(screen.getByText(/4831/)).toBeInTheDocument();
  });

  it('экстренная заявка помечена', () => {
    render(
      <OfferList
        initial={[offer({ isEmergency: true })]}
        topics={TOPICS}
        locale="ru"
      />,
    );

    expect(screen.getByText(/Экстренно/)).toBeInTheDocument();
  });

  it('приём ведёт к консультации', async () => {
    apiFetch.mockResolvedValue({
      requestId: 'r1',
      status: 'MATCHED',
      consultationId: 'c1',
    });
    render(<OfferList initial={[offer()]} topics={TOPICS} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: 'Принять' }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/ru/expert/consultations/c1'),
    );
  });

  it('отклонение убирает заявку из списка', async () => {
    apiFetch.mockResolvedValue(null);
    render(<OfferList initial={[offer()]} topics={TOPICS} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: 'Отклонить' }));

    await waitFor(() =>
      expect(screen.getByText(/новых заявок нет/i)).toBeInTheDocument(),
    );
  });

  it('истёкшую заявку принять нельзя', () => {
    render(
      <OfferList
        initial={[offer({ deadlineAt: past() })]}
        topics={TOPICS}
        locale="ru"
      />,
    );

    // Кнопка, которая гарантированно вернёт ошибку, хуже её отсутствия.
    expect(screen.getByRole('button', { name: 'Принять' })).toBeDisabled();
  });

  it('новая заявка приходит событием, без перезагрузки', async () => {
    render(<OfferList initial={[]} topics={TOPICS} locale="ru" />);
    await waitFor(() => expect(handlers['offer.new']).toBeDefined());

    await act(async () => {
      handlers['offer.new'](offer({ offerId: 'o2', clientCode: 7777 }));
    });

    expect(screen.getByText(/7777/)).toBeInTheDocument();
  });

  it('отозванная заявка исчезает сама', async () => {
    render(<OfferList initial={[offer()]} topics={TOPICS} locale="ru" />);
    await waitFor(() => expect(handlers['offer.revoked']).toBeDefined());

    await act(async () => {
      handlers['offer.revoked']({ offerId: 'o1' });
    });

    // Иначе эксперт жмёт «принять» на заявке, которую уже забрал другой.
    expect(screen.getByText(/новых заявок нет/i)).toBeInTheDocument();
  });

  it('после ready/reconnect пересверяет офферы через REST', async () => {
    apiFetch.mockResolvedValue([offer({ offerId: 'o2', clientCode: 7777 })]);
    render(<OfferList initial={[]} topics={TOPICS} locale="ru" />);
    await waitFor(() => expect(readyHandler).toBeDefined());

    await act(async () => readyHandler?.({}));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('experts/me/offers'),
    );
    expect(await screen.findByText(/7777/)).toBeInTheDocument();
  });

  it('не затирает realtime-оффер устаревшим REST snapshot', async () => {
    let resolveSnapshot!: (value: unknown) => void;
    apiFetch
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveSnapshot = resolve)),
      )
      .mockResolvedValueOnce([offer({ offerId: 'o2', clientCode: 7777 })]);
    render(<OfferList initial={[]} topics={TOPICS} locale="ru" />);
    await waitFor(() => expect(readyHandler).toBeDefined());

    await act(async () => readyHandler?.({}));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      handlers['offer.new'](offer({ offerId: 'o2', clientCode: 7777 }));
      resolveSnapshot([]);
    });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/7777/)).toBeInTheDocument();
  });

  it('при неизвестном результате приёма не удаляет оффер и запрещает слепой retry', async () => {
    apiFetch.mockRejectedValueOnce(new TypeError('response lost'));
    render(<OfferList initial={[offer()]} topics={TOPICS} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: 'Принять' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/неизвестен/i);
    expect(screen.getByText(/4831/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Принять' })).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('при подтверждённом конфликте убирает уже недоступный оффер', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(409, 'OFFER_ALREADY_TAKEN'));
    render(<OfferList initial={[offer()]} topics={TOPICS} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: 'Принять' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/недоступ/i);
    expect(screen.getByText(/новых заявок нет/i)).toBeInTheDocument();
  });

  it('блокирует все offer actions, пока одно принятие не завершилось', async () => {
    let resolveAccept!: (value: unknown) => void;
    apiFetch.mockImplementationOnce(
      () => new Promise((resolve) => (resolveAccept = resolve)),
    );
    render(
      <OfferList
        initial={[offer(), offer({ offerId: 'o2', clientCode: 7777 })]}
        topics={TOPICS}
        locale="ru"
      />,
    );

    const acceptButtons = screen.getAllByRole('button', { name: 'Принять' });
    fireEvent.click(acceptButtons[0]);
    fireEvent.click(acceptButtons[1]);

    expect(apiFetch).toHaveBeenCalledTimes(1);
    await act(async () =>
      resolveAccept({
        requestId: 'r1',
        status: 'MATCHED',
        consultationId: 'c1',
      }),
    );
  });

  it('локализует действия для казахского кабинета', () => {
    render(<OfferList initial={[offer()]} topics={TOPICS} locale="kz" />);

    expect(
      screen.getByRole('button', { name: 'Қабылдау' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Бас тарту' }),
    ).toBeInTheDocument();
  });
});
