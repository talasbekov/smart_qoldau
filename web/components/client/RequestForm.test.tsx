import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// eslint-disable-next-line import/first
import RequestForm from './RequestForm';

const TOPICS = [
  { id: '1', slug: 'burnout', name: 'Выгорание' },
  { id: '2', slug: 'anxiety-stress', name: 'Тревога и стресс' },
];

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

function mock(status: number, payload: unknown) {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /Найти специалиста/ }));
}

describe('RequestForm', () => {
  it('тема и формат — поля с видимыми подписями', () => {
    render(<RequestForm topics={TOPICS} locale="ru" />);

    expect(screen.getByLabelText('С чем нужна помощь')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Формат консультации' })).toBeInTheDocument();
  });

  it('не отправляет заявку без выбранной темы', async () => {
    const fetchMock = mock(201, {});
    render(<RequestForm topics={TOPICS} locale="ru" />);

    submit();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/тем/i));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('отправляет slug темы и формат, как ждёт контракт', async () => {
    const fetchMock = mock(201, { id: 'r1', status: 'SEARCHING' });
    render(<RequestForm topics={TOPICS} locale="ru" />);

    fireEvent.change(screen.getByLabelText('С чем нужна помощь'), { target: { value: 'burnout' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Видео' }));
    submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body).toEqual({ topicSlug: 'burnout', format: 'video', isEmergency: false });
  });

  it('уводит на страницу ожидания подбора', async () => {
    mock(201, { id: 'r1', status: 'SEARCHING' });
    render(<RequestForm topics={TOPICS} locale="ru" />);

    fireEvent.change(screen.getByLabelText('С чем нужна помощь'), { target: { value: 'burnout' } });
    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/ru/requests/r1'));
  });

  it('срочная заявка помечается явно и объясняет, чем отличается', async () => {
    const fetchMock = mock(201, { id: 'r1' });
    render(<RequestForm topics={TOPICS} locale="ru" />);

    fireEvent.change(screen.getByLabelText('С чем нужна помощь'), { target: { value: 'burnout' } });
    fireEvent.click(screen.getByLabelText(/срочно/i));
    submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.isEmergency).toBe(true);
  });

  it('на время запроса блокирует повторную отправку', async () => {
    let release: (v: unknown) => void = () => {};
    global.fetch = jest.fn().mockReturnValue(new Promise((r) => (release = r))) as unknown as typeof fetch;
    render(<RequestForm topics={TOPICS} locale="ru" />);

    fireEvent.change(screen.getByLabelText('С чем нужна помощь'), { target: { value: 'burnout' } });
    submit();

    await waitFor(() => expect(screen.getByRole('button', { name: /Ищем/ })).toBeDisabled());
    release({ ok: true, status: 201, json: async () => ({ id: 'r1' }) });
  });

  it('ошибку бэкенда показывает словами', async () => {
    mock(429, { code: 'REQUEST_RATE_LIMITED' });
    render(<RequestForm topics={TOPICS} locale="ru" />);

    fireEvent.change(screen.getByLabelText('С чем нужна помощь'), { target: { value: 'burnout' } });
    submit();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/слишком часто/i));
  });
});
