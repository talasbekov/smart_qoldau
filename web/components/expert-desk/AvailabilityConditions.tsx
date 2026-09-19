'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/generated';
import { almatyDateKey } from '@/lib/format-almaty';
import { deskCopy } from './copy';

type Me = components['schemas']['ExpertMeDto'];
type Schedule = components['schemas']['ScheduleResponseDto'];
type Exception = components['schemas']['ScheduleExceptionDto'];
type Assessment =
  'loading' | 'unknown' | 'blocked' | 'unverified' | 'outside' | 'eligible';

export default function AvailabilityConditions({ locale }: { locale: string }) {
  const copy = deskCopy(locale);
  const mounted = useRef(false);
  const revision = useRef(0);
  const [assessment, setAssessment] = useState<Assessment>('loading');
  const refresh = useCallback(async (alive: () => boolean) => {
    const request = ++revision.current;
    const current = () =>
      alive() && mounted.current && request === revision.current;
    try {
      const now = new Date();
      const date = almatyDateKey(now.toISOString());
      const [me, schedule, exceptions] = await Promise.all([
        apiFetch<Me>('experts/me'),
        apiFetch<Schedule>('experts/me/schedule'),
        apiFetch<Exception[]>(
          `experts/me/schedule/exceptions?from=${date}&to=${date}`,
        ),
      ]);
      if (!current()) return;
      if (!me || !schedule || !exceptions)
        throw new Error('missing availability');
      const local = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
      const exception = exceptions.find((item) => item.date === date);
      const day = schedule.days.find(
        (item) => item.weekday === (local.getUTCDay() + 6) % 7,
      );
      const within = exception
        ? !exception.isDayOff &&
          exception.startMin != null &&
          exception.endMin != null &&
          minute >= exception.startMin &&
          minute < exception.endMin
        : !!day?.enabled &&
          minute >= day.startMin &&
          minute < day.endMin &&
          !(
            day.breakStart != null &&
            day.breakEnd != null &&
            minute >= day.breakStart &&
            minute < day.breakEnd
          );
      setAssessment(
        me.isBlocked
          ? 'blocked'
          : me.verificationStatus !== 'VERIFIED'
            ? 'unverified'
            : !within
              ? 'outside'
              : 'eligible',
      );
    } catch {
      if (current()) setAssessment('unknown');
    }
  }, []);
  useEffect(() => {
    let alive = true;
    mounted.current = true;
    const update = () => {
      if (document.visibilityState === 'visible') void refresh(() => alive);
    };
    update();
    const timer = setInterval(update, 60_000);
    window.addEventListener('sq:expert-work-status-sync', update);
    window.addEventListener('sq:expert-availability-sync', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      alive = false;
      mounted.current = false;
      revision.current += 1;
      clearInterval(timer);
      window.removeEventListener('sq:expert-work-status-sync', update);
      window.removeEventListener('sq:expert-availability-sync', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);
  const target =
    assessment === 'blocked'
      ? 'expert/support'
      : assessment === 'unverified'
        ? 'expert-onboarding'
        : 'expert/schedule';
  const label =
    assessment === 'blocked'
      ? copy.support
      : assessment === 'unverified'
        ? copy.documents
        : copy.schedule;
  return (
    <div className="mt-2 text-xs text-muted">
      <p className="font-bold">{copy.eligibility}</p>
      <p>{copy[assessment]}</p>
      {assessment === 'unknown' ? (
        <button
          type="button"
          onClick={() => void refresh(() => mounted.current)}
          className="min-h-11 font-bold text-primary"
        >
          {copy.retry}
        </button>
      ) : null}
      <Link
        href={`/${locale}/${target}`}
        className="inline-flex min-h-11 items-center font-bold text-primary"
      >
        {label}
      </Link>
    </div>
  );
}
