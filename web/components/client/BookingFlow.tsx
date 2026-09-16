'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { components } from '@/lib/api/generated';
import { ApiError, apiFetch } from '@/lib/api/client';
import {
  almatyDateKey,
  formatAlmatyDay,
  formatAlmatyTime,
} from '@/lib/format-almaty';
import type { Consultation } from './ConsultationList';

type Expert = components['schemas']['ExpertPublicDto'];
type Topic = components['schemas']['TopicDto'];
type Slots = components['schemas']['SlotsResponseDto'];
type PaymentMethod = components['schemas']['PaymentMethodDto'];
type BookingResult = components['schemas']['BookingResultDto'];
type Notice = 'conflict' | 'saveError' | 'notConfirmed' | null;
type Phase = 'loading' | 'idle' | 'submitting' | 'unknown';

function tenge(priceTiyn: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === 'kz' ? 'kk-KZ' : 'ru-KZ').format(
    Math.round(priceTiyn / 100),
  )} ₸`;
}

function methodLabel(method: PaymentMethod): string {
  return `${method.maskedPan} · ${method.brand.toUpperCase()}`;
}

export default function BookingFlow({
  expert,
  topics,
  locale,
  consultation,
}: {
  expert: Expert;
  topics: Topic[];
  locale: string;
  consultation?: Consultation;
}) {
  const t = useTranslations('booking');
  const { replace, refresh } = useRouter();
  const isReschedule = Boolean(consultation);
  const relevantTopics = useMemo(
    () =>
      expert.topicSlugs.map(
        (slug) =>
          topics.find((topic) => topic.slug === slug) ?? { slug, name: slug },
      ),
    [expert.topicSlugs, topics],
  );
  const [slots, setSlots] = useState<Slots['items'] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[] | null>(
    isReschedule ? [] : null,
  );
  const [methodsError, setMethodsError] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [topicSlug, setTopicSlug] = useState(relevantTopics[0]?.slug ?? '');
  const [format, setFormat] = useState(
    expert.formats.includes('video') ? 'video' : (expert.formats[0] ?? ''),
  );
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [notice, setNotice] = useState<Notice>(null);
  const submitLock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadSlots = useCallback(async () => {
    if (!mounted.current) return;
    setSlotsError(false);
    try {
      const result = await apiFetch<Slots>(`experts/${expert.id}/slots`);
      if (!mounted.current) return;
      const items = result?.items ?? [];
      setSlots(items);
      setSelectedSlot((current) => {
        const next =
          current && items.some((slot) => slot.startAt === current)
            ? current
            : (items[0]?.startAt ?? null);
        setSelectedDay(next ? almatyDateKey(next) : null);
        return next;
      });
    } catch {
      if (!mounted.current) return;
      setSlots(null);
      setSlotsError(true);
    }
  }, [expert.id]);

  const loadMethods = useCallback(async () => {
    if (isReschedule || !mounted.current) return;
    setMethodsError(false);
    try {
      const result = await apiFetch<PaymentMethod[]>('payment-methods');
      if (!mounted.current) return;
      const items = result ?? [];
      setMethods(items);
      setPaymentMethodId((current) =>
        current && items.some((method) => method.id === current)
          ? current
          : (items[0]?.id ?? null),
      );
    } catch {
      if (!mounted.current) return;
      setMethods(null);
      setMethodsError(true);
    }
  }, [isReschedule]);

  useEffect(() => {
    void Promise.all([loadSlots(), loadMethods()]).finally(() => {
      if (mounted.current) setPhase('idle');
    });
  }, [loadMethods, loadSlots]);

  const byDay = useMemo(() => {
    const grouped = new Map<string, Slots['items']>();
    for (const slot of slots ?? []) {
      const key = almatyDateKey(slot.startAt);
      const day = grouped.get(key) ?? [];
      day.push(slot);
      grouped.set(key, day);
    }
    return grouped;
  }, [slots]);

  const openConsultation = useCallback(
    (id: string) => {
      replace(`/${locale}/consultations/${id}`);
      refresh();
    },
    [locale, refresh, replace],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      submitLock.current ||
      !selectedSlot ||
      (!isReschedule && (!topicSlug || !format || !paymentMethodId))
    ) {
      return;
    }

    submitLock.current = true;
    setNotice(null);
    setPhase('submitting');
    try {
      const result = isReschedule
        ? await apiFetch<BookingResult>(
            `consultations/${consultation!.id}/reschedule`,
            {
              method: 'POST',
              body: JSON.stringify({ slotStartAt: selectedSlot }),
            },
          )
        : await apiFetch<BookingResult>('bookings', {
            method: 'POST',
            body: JSON.stringify({
              expertId: expert.id,
              topicSlug,
              format,
              slotStartAt: selectedSlot,
              paymentMethodId,
            }),
          });
      if (!mounted.current) return;
      if (!result?.consultationId) {
        setPhase('unknown');
        return;
      }
      openConsultation(result.consultationId);
    } catch (caught) {
      if (!mounted.current) return;
      if (
        caught instanceof ApiError &&
        (caught.code === 'SLOT_TAKEN' ||
          caught.code === 'SLOT_UNAVAILABLE' ||
          caught.code === 'SLOT_OUT_OF_RANGE')
      ) {
        setPhase('loading');
        setNotice('conflict');
        await loadSlots();
        if (!mounted.current) return;
        submitLock.current = false;
        setPhase('idle');
        return;
      }
      if (caught instanceof ApiError && caught.status < 500) {
        submitLock.current = false;
        setPhase('idle');
        setNotice('saveError');
        return;
      }
      setPhase('unknown');
    }
  }

  async function reconcile() {
    if (!selectedSlot) return;
    setNotice(null);
    try {
      if (consultation) {
        const current = await apiFetch<Consultation>(
          `consultations/${consultation.id}`,
        );
        if (current?.startedAt === selectedSlot) {
          openConsultation(consultation.id);
          return;
        }
      } else {
        const items = await apiFetch<Consultation[]>(
          'consultations?status=SCHEDULED&take=100',
        );
        const found = items?.find(
          (item) =>
            item.expert.id === expert.id &&
            item.startedAt === selectedSlot &&
            item.status === 'SCHEDULED',
        );
        if (found) {
          openConsultation(found.id);
          return;
        }
      }
      submitLock.current = false;
      setPhase('idle');
      setNotice('notConfirmed');
      await loadSlots();
    } catch {
      setPhase('unknown');
    }
  }

  const disabled =
    phase !== 'idle' ||
    slots === null ||
    slots.length === 0 ||
    !selectedSlot ||
    (!isReschedule &&
      (!topicSlug ||
        !format ||
        !paymentMethodId ||
        methods === null ||
        methods.length === 0));
  const formatLabels: Record<string, string> = {
    chat: t('formatChat'),
    audio: t('formatAudio'),
    video: t('formatVideo'),
  };

  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-6">
      <div>
        <p className="mb-1 text-sm font-bold text-primary">
          {isReschedule ? t('rescheduleEyebrow') : t('bookingEyebrow')}
        </p>
        <h1 className="text-2xl font-extrabold text-ink">
          {isReschedule
            ? t('rescheduleTitle', { expert: expert.displayName })
            : t('bookingTitle', { expert: expert.displayName })}
        </h1>
        <p className="mt-2 text-sm text-muted">{t('timezone')}</p>
      </div>

      {slotsError ? (
        <section
          role="alert"
          aria-labelledby="slots-error-title"
          className="rounded-2xl border border-red-200 bg-red-50 p-5"
        >
          <h2 id="slots-error-title" className="font-extrabold text-ink">
            {t('slotsErrorTitle')}
          </h2>
          <p className="mt-1 text-sm text-body">{t('slotsErrorBody')}</p>
          <button
            type="button"
            onClick={() => void loadSlots()}
            className="mt-4 min-h-11 rounded-xl border border-border px-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {t('retry')}
          </button>
        </section>
      ) : slots === null ? (
        <p role="status" className="text-sm text-muted">
          {t('loadingSlots')}
        </p>
      ) : slots.length === 0 ? (
        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="font-extrabold text-ink">{t('emptyTitle')}</h2>
          <p className="mt-1 text-sm text-body">{t('emptyBody')}</p>
          <button
            type="button"
            onClick={() => void loadSlots()}
            className="mt-4 min-h-11 rounded-xl border border-border px-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {t('refreshSlots')}
          </button>
        </section>
      ) : (
        <section aria-labelledby="slot-title">
          <h2 id="slot-title" className="mb-3 text-lg font-extrabold text-ink">
            {t('chooseTime')}
          </h2>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
            {[...byDay.entries()].map(([key, daySlots]) => (
              <button
                key={key}
                type="button"
                aria-pressed={selectedDay === key}
                onClick={() => {
                  setSelectedDay(key);
                  setSelectedSlot(daySlots[0]?.startAt ?? null);
                }}
                className="min-h-11 shrink-0 rounded-xl border border-border px-4 text-sm font-bold text-ink aria-pressed:border-primary aria-pressed:bg-chip focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {formatAlmatyDay(daySlots[0].startAt, locale)}
              </button>
            ))}
          </div>
          <fieldset>
            <legend className="sr-only">{t('availableTimes')}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(selectedDay ? byDay.get(selectedDay) : [])?.map((slot) => (
                <label
                  key={slot.startAt}
                  className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border px-3 text-sm font-bold text-ink has-[:checked]:border-primary has-[:checked]:bg-chip"
                >
                  <input
                    type="radio"
                    name="slot"
                    value={slot.startAt}
                    checked={selectedSlot === slot.startAt}
                    onChange={() => setSelectedSlot(slot.startAt)}
                    className="sr-only"
                  />
                  {formatAlmatyTime(slot.startAt)}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      )}

      {!isReschedule ? (
        <>
          <label className="flex flex-col gap-2 text-sm font-bold text-ink">
            {t('topic')}
            <select
              value={topicSlug}
              onChange={(event) => setTopicSlug(event.target.value)}
              className="min-h-12 rounded-xl border border-border bg-white px-4 font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {relevantTopics.map((topic) => (
                <option key={topic.slug} value={topic.slug}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">
              {t('format')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {expert.formats.map((item) => (
                <label
                  key={item}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-chip"
                >
                  <input
                    type="radio"
                    name="format"
                    value={item}
                    checked={format === item}
                    onChange={() => setFormat(item)}
                  />
                  {formatLabels[item] ?? item}
                </label>
              ))}
            </div>
          </fieldset>
          <section aria-labelledby="payment-title">
            <h2 id="payment-title" className="mb-2 text-sm font-bold text-ink">
              {t('paymentMethod')}
            </h2>
            {methodsError ? (
              <div role="alert" className="text-sm text-red-700">
                <p>{t('methodsError')}</p>
                <button
                  type="button"
                  onClick={() => void loadMethods()}
                  className="mt-2 min-h-11 rounded-xl border border-border px-4 font-bold text-primary"
                >
                  {t('retry')}
                </button>
              </div>
            ) : methods === null ? (
              <p role="status" className="text-sm text-muted">
                {t('loadingMethods')}
              </p>
            ) : methods.length === 0 ? (
              <p className="text-sm text-body">{t('emptyMethods')}</p>
            ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">{t('paymentMethod')}</legend>
                {methods.map((method) => (
                  <label
                    key={method.id}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-chip"
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={paymentMethodId === method.id}
                      onChange={() => setPaymentMethodId(method.id)}
                    />
                    {methodLabel(method)}
                  </label>
                ))}
              </fieldset>
            )}
          </section>
          <section className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-extrabold text-ink">{t('summary')}</h2>
              <p className="text-xl font-extrabold text-ink">
                {tenge(expert.priceTiyn, locale)}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted">{t('duration')}</p>
            <p className="mt-3 text-sm leading-6 text-body">{t('holdBody')}</p>
          </section>
        </>
      ) : null}

      {notice ? (
        <section
          role="alert"
          aria-labelledby="booking-notice-title"
          className="rounded-2xl border border-red-200 bg-red-50 p-5"
        >
          <h2 id="booking-notice-title" className="font-extrabold text-ink">
            {t(`${notice}Title`)}
          </h2>
          <p className="mt-1 text-sm text-body">{t(`${notice}Body`)}</p>
        </section>
      ) : null}

      {phase === 'unknown' ? (
        <section
          role="alert"
          aria-labelledby="unknown-title"
          className="rounded-2xl border border-border bg-chip p-5"
        >
          <h2 id="unknown-title" className="font-extrabold text-ink">
            {isReschedule
              ? t('unknownRescheduleTitle')
              : t('unknownBookingTitle')}
          </h2>
          <p className="mt-1 text-sm text-body">{t('unknownBody')}</p>
          <button
            type="button"
            onClick={() => void reconcile()}
            className="mt-4 min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {t('checkResult')}
          </button>
        </section>
      ) : null}

      <button
        type="submit"
        disabled={disabled}
        className="min-h-12 rounded-2xl bg-primary px-5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {phase === 'submitting'
          ? t('submitting')
          : isReschedule
            ? t('confirmReschedule')
            : t('confirmBooking')}
      </button>
    </form>
  );
}
