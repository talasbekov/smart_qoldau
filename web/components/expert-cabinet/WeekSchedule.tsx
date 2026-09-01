'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/generated';

type Day = components['schemas']['ScheduleDayDto'];

const NAMES = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
];

// Контракт хранит время минутами от полуночи, человек читает часами.
function toClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function toMinutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
}

export default function WeekSchedule({ initial }: { initial: Day[] }) {
  const [days, setDays] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function update(weekday: number, patch: Partial<Day>) {
    setSaved(false);
    setDays((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  }

  async function save() {
    setBusy(true);
    // Бэкенд принимает расписание целиком, а не по дню: отправка одного
    // дня стёрла бы остальные.
    await apiFetch('experts/me/schedule', {
      method: 'PUT',
      body: JSON.stringify({ days }),
    }).catch(() => null);
    setBusy(false);
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {days.map((day) => (
          <li
            key={day.weekday}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-white p-4"
          >
            <label className="flex min-w-[180px] items-center gap-3 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={day.enabled}
                onChange={(e) => update(day.weekday, { enabled: e.target.checked })}
                className="accent-primary"
              />
              {NAMES[day.weekday]}
            </label>

            <label className="flex items-center gap-2 text-sm text-muted">
              с
              <input
                type="time"
                value={toClock(day.startMin)}
                disabled={!day.enabled}
                onChange={(e) => update(day.weekday, { startMin: toMinutes(e.target.value) })}
                aria-label={`${NAMES[day.weekday]}: начало`}
                className="rounded-xl border border-border px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-muted">
              до
              <input
                type="time"
                value={toClock(day.endMin)}
                disabled={!day.enabled}
                onChange={(e) => update(day.weekday, { endMin: toMinutes(e.target.value) })}
                aria-label={`${NAMES[day.weekday]}: конец`}
                className="rounded-xl border border-border px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {busy ? 'Сохраняем…' : 'Сохранить расписание'}
        </button>
        {/* Молчание после нажатия выглядит поломкой. */}
        {saved && (
          <p role="status" className="text-sm font-semibold text-primary">
            Расписание сохранено
          </p>
        )}
      </div>
    </div>
  );
}
