import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiFetch = jest.fn().mockResolvedValue(null);
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
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

afterEach(() => jest.clearAllMocks());

describe('WeekSchedule', () => {
  it('показывает неделю целиком, а не один день', () => {
    render(<WeekSchedule initial={[0, 1, 2, 3, 4, 5, 6].map((w) => day(w))} />);

    for (const name of ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('выключенный день выглядит выключенным', () => {
    render(<WeekSchedule initial={[day(0, { enabled: false })]} />);

    expect(screen.getByRole('checkbox', { name: /Понедельник/ })).not.toBeChecked();
  });

  it('время показывается часами, а не минутами от полуночи', () => {
    render(<WeekSchedule initial={[day(0)]} />);

    // 540 минут — это 09:00, и человек должен видеть именно это.
    expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('18:00')).toBeInTheDocument();
  });

  it('сохранение шлёт ВЕСЬ набор дней: бэкенд принимает расписание целиком', async () => {
    render(<WeekSchedule initial={[0, 1, 2, 3, 4, 5, 6].map((w) => day(w))} />);

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const body = JSON.parse((apiFetch.mock.calls[0][1] as { body: string }).body);
    expect(body.days).toHaveLength(7);
  });

  it('время уходит минутами от полуночи, как ждёт контракт', async () => {
    render(<WeekSchedule initial={[day(0)]} />);

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const body = JSON.parse((apiFetch.mock.calls[0][1] as { body: string }).body);
    expect(body.days[0]).toMatchObject({ startMin: 540, endMin: 1080 });
  });

  it('говорит, что сохранилось: молчание после нажатия выглядит поломкой', async () => {
    render(<WeekSchedule initial={[day(0)]} />);

    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(/сохранен/i);
  });
});
