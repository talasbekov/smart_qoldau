import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const apiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
}));
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const handlers: Record<string, (p: unknown) => void> = {};
jest.mock('@/lib/realtime/socket', () => ({
  connectRealtime: async () => ({
    on: (event: string, handler: (p: unknown) => void) => {
      handlers[event] = handler;
      return () => delete handlers[event];
    },
    onReady: () => () => {},
    send: () => {},
    close: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import OfferList from './OfferList';

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
    render(<OfferList initial={[offer({ isEmergency: true })]} topics={TOPICS} locale="ru" />);

    expect(screen.getByText(/Экстренно/)).toBeInTheDocument();
  });

  it('приём ведёт к консультации', async () => {
    apiFetch.mockResolvedValue({ requestId: 'r1', status: 'MATCHED', consultationId: 'c1' });
    render(<OfferList initial={[offer()]} topics={TOPICS} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: 'Принять' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/ru/expert/consultations/c1'));
  });

  it('отклонение убирает заявку из списка', async () => {
    apiFetch.mockResolvedValue(null);
    render(<OfferList initial={[offer()]} topics={TOPICS} locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: 'Отклонить' }));

    await waitFor(() => expect(screen.getByText(/новых заявок нет/i)).toBeInTheDocument());
  });

  it('истёкшую заявку принять нельзя', () => {
    render(<OfferList initial={[offer({ deadlineAt: past() })]} topics={TOPICS} locale="ru" />);

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
});
