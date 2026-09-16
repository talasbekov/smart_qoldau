import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';

const apiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: jest.requireActual('@/lib/api/client').ApiError,
}));

// eslint-disable-next-line import/first
import WeekSchedule from './WeekSchedule';

const day = (weekday: number, over: Record<string, unknown> = {}) => ({
  weekday,
  enabled: true,
  startMin: 540,
  endMin: 1080,
  breakStart: null,
  breakEnd: null,
  ...over,
});
const fullWeek = () => [0, 1, 2, 3, 4, 5, 6].map((weekday) => day(weekday));

beforeEach(() => {
  apiFetch.mockResolvedValue({
    days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => day(weekday)),
  });
});

afterEach(() => jest.resetAllMocks());

describe('WeekSchedule', () => {
  it('показывает неделю целиком, а не один день', () => {
    render(<WeekSchedule initial={[0, 1, 2, 3, 4, 5, 6].map((w) => day(w))} />);

    for (const name of [
      'Понедельник',
      'Вторник',
      'Среда',
      'Четверг',
      'Пятница',
      'Суббота',
      'Воскресенье',
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('выключенный день выглядит выключенным', () => {
    render(<WeekSchedule initial={[day(0, { enabled: false })]} />);

    expect(
      screen.getByRole('checkbox', { name: /Понедельник/ }),
    ).not.toBeChecked();
  });

  it('время показывается часами, а не минутами от полуночи', () => {
    render(<WeekSchedule initial={fullWeek()} />);

    // 540 минут — это 09:00, и человек должен видеть именно это.
    expect(screen.getByLabelText('Понедельник: начало')).toHaveValue('09:00');
    expect(screen.getByLabelText('Понедельник: конец')).toHaveValue('18:00');
  });

  it('сохранение шлёт ВЕСЬ набор дней: бэкенд принимает расписание целиком', async () => {
    render(<WeekSchedule initial={[0, 1, 2, 3, 4, 5, 6].map((w) => day(w))} />);

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const body = JSON.parse(
      (apiFetch.mock.calls[0][1] as { body: string }).body,
    );
    expect(body.days).toHaveLength(7);
  });

  it('время уходит минутами от полуночи, как ждёт контракт', async () => {
    render(<WeekSchedule initial={fullWeek()} />);

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const body = JSON.parse(
      (apiFetch.mock.calls[0][1] as { body: string }).body,
    );
    expect(body.days[0]).toMatchObject({ startMin: 540, endMin: 1080 });
  });

  it('говорит, что сохранилось: молчание после нажатия выглядит поломкой', async () => {
    render(<WeekSchedule initial={fullWeek()} />);

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/сохранен/i);
  });

  it('не объявляет успех, когда API отклонил сохранение', async () => {
    apiFetch
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('still offline'));
    render(<WeekSchedule initial={[0, 1, 2, 3, 4, 5, 6].map((w) => day(w))} />);

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось/i);
    expect(screen.queryByText(/расписание сохранено/i)).toBeNull();
  });

  it('сверяет потерянный PUT через GET и подтверждает фактически сохранённое', async () => {
    const submittedWeek = fullWeek();
    apiFetch
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce({ days: submittedWeek });
    render(<WeekSchedule initial={submittedWeek} />);

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/сохранено/i);
    expect(apiFetch).toHaveBeenCalledWith('experts/me/schedule');
  });

  it('сверяет HTTP 5xx после PUT через GET как неизвестный результат', async () => {
    const submittedWeek = fullWeek();
    apiFetch
      .mockRejectedValueOnce(
        new (jest.requireActual('@/lib/api/client').ApiError)(500, null),
      )
      .mockResolvedValueOnce({ days: submittedWeek });
    render(<WeekSchedule initial={submittedWeek} />);

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/сохранено/i);
    expect(apiFetch).toHaveBeenCalledWith('experts/me/schedule');
  });

  it('не считает поздний ответ сохранением более свежей правки', async () => {
    let resolveSave!: (value: unknown) => void;
    apiFetch.mockImplementationOnce(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );
    const submittedWeek = fullWeek();
    render(<WeekSchedule initial={submittedWeek} />);

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    fireEvent.change(screen.getByLabelText('Понедельник: начало'), {
      target: { value: '10:00' },
    });
    await act(async () => resolveSave({ days: submittedWeek }));

    expect(screen.getByDisplayValue('10:00')).toBeInTheDocument();
    expect(screen.queryByText(/расписание сохранено/i)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/новые изменения/i);
  });

  it('не отправляет два сохранения по двойному нажатию', async () => {
    let resolveSave!: (value: unknown) => void;
    apiFetch.mockImplementationOnce(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );
    render(<WeekSchedule initial={[0, 1, 2, 3, 4, 5, 6].map((w) => day(w))} />);
    const button = screen.getByRole('button', { name: /Сохранить/ });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(apiFetch).toHaveBeenCalledTimes(1);
    await act(async () => resolveSave({ days: [] }));
  });

  it('редактирует перерыв и отправляет его вместе со всей неделей', async () => {
    render(<WeekSchedule initial={[0, 1, 2, 3, 4, 5, 6].map((w) => day(w))} />);

    fireEvent.change(screen.getByLabelText('Понедельник: начало перерыва'), {
      target: { value: '13:00' },
    });
    fireEvent.change(screen.getByLabelText('Понедельник: конец перерыва'), {
      target: { value: '14:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const body = JSON.parse(
      (apiFetch.mock.calls[0][1] as { body: string }).body,
    );
    expect(body.days[0]).toMatchObject({ breakStart: 780, breakEnd: 840 });
  });

  it('останавливает невалидное окно до сети', async () => {
    render(<WeekSchedule initial={[0, 1, 2, 3, 4, 5, 6].map((w) => day(w))} />);
    fireEvent.change(screen.getByLabelText('Понедельник: конец'), {
      target: { value: '08:00' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/после начала/i);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('показывает казахскую подпись действия', () => {
    render(<WeekSchedule initial={fullWeek()} locale="kz" />);

    expect(
      screen.getByRole('button', { name: /кестені сақтау/i }),
    ).toBeInTheDocument();
  });
});
