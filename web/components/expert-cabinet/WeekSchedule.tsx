'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/generated';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type Day = components['schemas']['ScheduleDayDto'];
type ScheduleResponse = components['schemas']['ScheduleResponseDto'];
type Phase = 'idle' | 'saving' | 'saved' | 'unsaved' | 'error' | 'invalid';

function toClock(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function toMinutes(clock: string): number | null {
  if (!clock) return null;
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

function sameSchedule(left: Day[], right: Day[]): boolean {
  const fields = (days: Day[]) =>
    [...days]
      .sort((a, b) => a.weekday - b.weekday)
      .map((day) => ({
        weekday: day.weekday,
        enabled: day.enabled,
        startMin: day.startMin,
        endMin: day.endMin,
        breakStart: day.breakStart ?? null,
        breakEnd: day.breakEnd ?? null,
      }));
  return JSON.stringify(fields(left)) === JSON.stringify(fields(right));
}

export default function WeekSchedule({
  initial,
  locale = 'ru',
}: {
  initial: Day[];
  locale?: string;
}) {
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const names = [
    copy.day0,
    copy.day1,
    copy.day2,
    copy.day3,
    copy.day4,
    copy.day5,
    copy.day6,
  ];
  const [days, setDays] = useState(initial);
  const [phase, setPhase] = useState<Phase>('idle');
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const revision = useRef(0);
  const saveLock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function update(weekday: number, patch: Partial<Day>) {
    revision.current += 1;
    setPhase('idle');
    setValidationMessage(null);
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, ...patch } : day,
      ),
    );
  }

  function validate(snapshot: Day[]): string | null {
    if (snapshot.length !== 7) return copy.scheduleError;
    for (const day of snapshot) {
      if (!day.enabled) continue;
      if (day.startMin >= day.endMin) return copy.scheduleInvalidWindow;
      const hasBreakStart =
        day.breakStart !== null && day.breakStart !== undefined;
      const hasBreakEnd = day.breakEnd !== null && day.breakEnd !== undefined;
      if (hasBreakStart !== hasBreakEnd) return copy.scheduleInvalidBreak;
      if (
        hasBreakStart &&
        hasBreakEnd &&
        !(
          day.startMin <= (day.breakStart as number) &&
          (day.breakStart as number) < (day.breakEnd as number) &&
          (day.breakEnd as number) <= day.endMin
        )
      ) {
        return copy.scheduleInvalidBreak;
      }
    }
    return null;
  }

  async function save() {
    if (saveLock.current) return;
    const snapshot = days.map((day) => ({ ...day }));
    const invalid = validate(snapshot);
    if (invalid) {
      setValidationMessage(invalid);
      setPhase('invalid');
      return;
    }

    saveLock.current = true;
    const submittedRevision = revision.current;
    setPhase('saving');
    setValidationMessage(null);
    try {
      const confirmed = await apiFetch<ScheduleResponse>(
        'experts/me/schedule',
        {
          method: 'PUT',
          body: JSON.stringify({ days: snapshot }),
        },
      );
      if (!mounted.current) return;
      if (!confirmed || confirmed.days.length !== 7) {
        throw new Error('schedule confirmation missing');
      }
      if (revision.current === submittedRevision) {
        setDays(confirmed.days);
        setPhase('saved');
      } else {
        setPhase('unsaved');
      }
    } catch (caught) {
      if (!mounted.current) return;
      // A 4xx response definitively rejects this payload. A 5xx may be the
      // backend's final read failing after its transaction already committed,
      // so it has the same unknown outcome as a lost transport response.
      if (caught instanceof ApiError && caught.status < 500) {
        setPhase('error');
        return;
      }

      // A lost PUT response is an unknown result, not a confirmed failure.
      // The full replacement is safe to inspect through the canonical GET.
      try {
        const current = await apiFetch<ScheduleResponse>('experts/me/schedule');
        if (!mounted.current) return;
        if (current && sameSchedule(current.days, snapshot)) {
          if (revision.current === submittedRevision) {
            setDays(current.days);
            setPhase('saved');
          } else {
            setPhase('unsaved');
          }
        } else {
          setPhase('error');
        }
      } catch {
        if (mounted.current) setPhase('error');
      }
    } finally {
      saveLock.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {days.map((day) => {
          const name = names[day.weekday] ?? String(day.weekday);
          return (
            <li
              key={day.weekday}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <label className="flex min-h-11 min-w-[180px] items-center gap-3 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(event) =>
                    update(day.weekday, { enabled: event.target.checked })
                  }
                  className="h-5 w-5 accent-primary"
                />
                {name}
              </label>

              <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
                {copy.start}
                <input
                  type="time"
                  value={toClock(day.startMin)}
                  disabled={!day.enabled}
                  onChange={(event) => {
                    const value = toMinutes(event.target.value);
                    if (value !== null)
                      update(day.weekday, { startMin: value });
                  }}
                  aria-label={`${name}: ${locale === 'kz' ? copy.start : 'начало'}`}
                  className="min-h-11 rounded-xl border border-border px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
                {copy.end}
                <input
                  type="time"
                  value={toClock(day.endMin)}
                  disabled={!day.enabled}
                  onChange={(event) => {
                    const value = toMinutes(event.target.value);
                    if (value !== null) update(day.weekday, { endMin: value });
                  }}
                  aria-label={`${name}: ${locale === 'kz' ? copy.end : 'конец'}`}
                  className="min-h-11 rounded-xl border border-border px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <fieldset className="flex flex-wrap items-center gap-2 sm:basis-full sm:pl-[196px]">
                <legend className="sr-only">{`${name}: ${copy.break}`}</legend>
                <span className="text-xs font-semibold text-muted">
                  {copy.break}
                </span>
                <input
                  type="time"
                  value={toClock(day.breakStart)}
                  disabled={!day.enabled}
                  onChange={(event) =>
                    update(day.weekday, {
                      breakStart: toMinutes(event.target.value),
                    })
                  }
                  aria-label={`${name}: ${copy.breakStart}`}
                  className="min-h-11 rounded-xl border border-border px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span aria-hidden="true" className="text-muted">
                  —
                </span>
                <input
                  type="time"
                  value={toClock(day.breakEnd)}
                  disabled={!day.enabled}
                  onChange={(event) =>
                    update(day.weekday, {
                      breakEnd: toMinutes(event.target.value),
                    })
                  }
                  aria-label={`${name}: ${copy.breakEnd}`}
                  className="min-h-11 rounded-xl border border-border px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </fieldset>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={phase === 'saving'}
          className="min-h-11 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {phase === 'saving' ? copy.savingSchedule : copy.saveSchedule}
        </button>
        {phase === 'saved' ? (
          <p role="status" className="text-sm font-semibold text-primary">
            {copy.scheduleSaved}
          </p>
        ) : null}
        {phase === 'unsaved' ? (
          <p role="status" className="text-sm font-semibold text-muted">
            {copy.scheduleUnsaved}
          </p>
        ) : null}
        {phase === 'error' || phase === 'invalid' ? (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {validationMessage ?? copy.scheduleError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
