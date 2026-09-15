'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { components } from '@/lib/api/generated';
import { apiFetch, ApiError } from '@/lib/api/client';
import type { Consultation } from './ConsultationList';

type PaymentMethod = components['schemas']['PaymentMethodDto'];
type PaymentStatus = components['schemas']['PaymentStatusDto'];
type PayResult = components['schemas']['PayResultDto'];
type PremiumStatus = components['schemas']['PremiumStatusDto'];
type PremiumPlans = components['schemas']['PremiumPlansDto'];

type Phase =
  | 'checking'
  | 'idle'
  | 'pending'
  | 'declined'
  | 'unknown'
  | 'captured'
  | 'voided'
  | 'unavailable';

type ReconcileResult =
  PaymentStatus['status'] | 'NOT_FOUND' | 'UNKNOWN' | 'STALE';
type PremiumPricing =
  | { kind: 'loading' }
  | { kind: 'inactive' }
  | { kind: 'active'; discountPercent: number }
  | { kind: 'unknown' };

const POLL_DELAY_MS = 1500;

function tenge(priceTiyn: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === 'kz' ? 'kk-KZ' : 'ru-KZ').format(
    Math.round(priceTiyn / 100),
  )} ₸`;
}

function cardLabel(card: PaymentMethod): string {
  return `${card.maskedPan} · ${card.brand.toUpperCase()}`;
}

export default function PaymentCheckout({
  consultation,
  locale,
}: {
  consultation: Consultation;
  locale: string;
}) {
  const t = useTranslations('checkout');
  const { replace, refresh } = useRouter();
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [methodsError, setMethodsError] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmedAmountTiyn, setConfirmedAmountTiyn] = useState<number | null>(
    null,
  );
  const [premiumPricing, setPremiumPricing] = useState<PremiumPricing>({
    kind: 'loading',
  });
  const submitLock = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const payable =
    consultation.status === 'ACTIVE' || consultation.status === 'SCHEDULED';
  const consultationHref = `/${locale}/consultations/${consultation.id}`;

  const openConsultation = useCallback(() => {
    if (!mountedRef.current) return;
    replace(consultationHref);
    refresh();
  }, [consultationHref, refresh, replace]);

  const loadMethods = useCallback(async () => {
    if (!mountedRef.current) return;
    setMethodsError(false);
    try {
      const list = await apiFetch<PaymentMethod[]>('payment-methods');
      if (!mountedRef.current) return;
      const next = list ?? [];
      setMethods(next);
      setSelectedMethodId((current) =>
        current && next.some((method) => method.id === current)
          ? current
          : (next[0]?.id ?? null),
      );
    } catch {
      if (!mountedRef.current) return;
      setMethodsError(true);
      setMethods(null);
    }
  }, []);

  const loadPremiumPricing = useCallback(async () => {
    try {
      const premium = await apiFetch<PremiumStatus>('premium');
      if (!mountedRef.current) return;
      if (!premium) {
        setPremiumPricing({ kind: 'unknown' });
        return;
      }
      if (!premium.active) {
        setPremiumPricing({ kind: 'inactive' });
        return;
      }

      const plans = await apiFetch<PremiumPlans>('premium/plans');
      if (!mountedRef.current) return;
      if (
        !plans ||
        !Number.isFinite(plans.discountPercent) ||
        plans.discountPercent < 0 ||
        plans.discountPercent > 100
      ) {
        setPremiumPricing({ kind: 'unknown' });
        return;
      }
      setPremiumPricing({
        kind: 'active',
        discountPercent: plans.discountPercent,
      });
    } catch {
      if (!mountedRef.current) return;
      setPremiumPricing({ kind: 'unknown' });
    }
  }, []);

  const reconcile = useCallback(async (): Promise<ReconcileResult> => {
    if (!mountedRef.current) return 'STALE';
    setMessage(null);
    setPhase((current) => (current === 'pending' ? 'pending' : 'checking'));
    try {
      const payment = await apiFetch<PaymentStatus>(
        `consultations/${consultation.id}/payment`,
      );
      if (!mountedRef.current) return 'STALE';
      if (!payment) {
        setPhase('unknown');
        setMessage(t('statusUnknown'));
        return 'UNKNOWN';
      }

      setConfirmedAmountTiyn(payment.amountTiyn);
      switch (payment.status) {
        case 'HELD':
          submitLock.current = false;
          openConsultation();
          return 'HELD';
        case 'PENDING':
          setPhase('pending');
          return 'PENDING';
        case 'FAILED':
          submitLock.current = false;
          setPhase('declined');
          setMessage(t('declinedBody'));
          return 'FAILED';
        case 'CAPTURED':
          submitLock.current = false;
          setPhase('captured');
          return 'CAPTURED';
        case 'VOIDED':
          submitLock.current = false;
          setPhase('voided');
          return 'VOIDED';
      }
    } catch (caught) {
      if (!mountedRef.current) return 'STALE';
      if (
        caught instanceof ApiError &&
        caught.status === 404 &&
        caught.code === 'PAYMENT_NOT_FOUND'
      ) {
        submitLock.current = false;
        setConfirmedAmountTiyn(null);
        setPhase('idle');
        return 'NOT_FOUND';
      }
      setPhase('unknown');
      setMessage(t('statusUnknown'));
      return 'UNKNOWN';
    }
  }, [consultation.id, openConsultation, t]);

  useEffect(() => {
    if (!payable) {
      setPhase('unavailable');
      return;
    }
    void loadMethods();
    void loadPremiumPricing();
    void reconcile();
  }, [loadMethods, loadPremiumPricing, payable, reconcile]);

  useEffect(() => {
    if (phase !== 'pending') return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      const result = await reconcile();
      // Следующий запрос начинается только после завершения предыдущего:
      // одинаковый PENDING не меняет React state и сам по себе не
      // перезапустил бы effect.
      if (!cancelled && result === 'PENDING') {
        timer = window.setTimeout(() => void poll(), POLL_DELAY_MS);
      }
    };

    timer = window.setTimeout(() => void poll(), POLL_DELAY_MS);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [phase, reconcile]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !mountedRef.current ||
      !selectedMethodId ||
      submitLock.current ||
      phase === 'checking' ||
      phase === 'pending'
    ) {
      return;
    }

    submitLock.current = true;
    setMessage(null);
    setPhase('checking');
    try {
      const result = await apiFetch<PayResult>(
        `consultations/${consultation.id}/pay`,
        {
          method: 'POST',
          body: JSON.stringify({ paymentMethodId: selectedMethodId }),
        },
      );
      if (!mountedRef.current) return;
      if (result?.status === 'HELD') {
        submitLock.current = false;
        openConsultation();
        return;
      }
      await reconcile();
    } catch (caught) {
      if (!mountedRef.current) return;
      if (caught instanceof ApiError && caught.code === 'PROVIDER_DECLINED') {
        submitLock.current = false;
        setPhase('declined');
        setMessage(t('declinedBody'));
        return;
      }
      if (
        caught instanceof ApiError &&
        caught.code === 'PAYMENT_METHOD_NOT_FOUND'
      ) {
        submitLock.current = false;
        setPhase('idle');
        setMessage(t('methodMissing'));
        await loadMethods();
        return;
      }
      if (
        caught instanceof ApiError &&
        caught.code === 'CONSULTATION_NOT_ACTIVE'
      ) {
        submitLock.current = false;
        setPhase('unavailable');
        setMessage(t('notActive'));
        return;
      }

      // ALREADY_PAID, 5xx и транспортная ошибка не доказывают ни успех,
      // ни отказ. GET — единственный безопасный способ решить, можно ли
      // вести в сессию или предлагать следующую попытку.
      await reconcile();
    }
  }

  const estimatedPremiumAmountTiyn =
    premiumPricing.kind === 'active'
      ? consultation.priceTiyn -
        Math.round(
          (consultation.priceTiyn * premiumPricing.discountPercent) / 100,
        )
      : null;
  const canPay =
    payable &&
    premiumPricing.kind !== 'loading' &&
    methods !== null &&
    methods.length > 0 &&
    selectedMethodId !== null &&
    (phase === 'idle' || phase === 'declined');
  const payLabel = phase === 'declined' ? t('retryPayment') : t('pay');

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href={consultationHref}
          className="inline-flex min-h-11 items-center rounded-xl text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {t('back')}
        </Link>
        <h1 className="text-2xl font-extrabold text-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-body">
          {consultation.expert.displayName}
        </p>
      </div>

      <section className="rounded-[20px] border border-border bg-white p-5 sm:p-6">
        <div>
          <div>
            <h2 className="font-extrabold text-ink">{t('lineItem')}</h2>
            <p className="mt-1 text-sm text-muted">
              {t('duration', { minutes: consultation.plannedDurationMin })}
            </p>
          </div>
          <dl className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-body">{t('basePrice')}</dt>
              <dd className="shrink-0 font-bold tabular-nums text-ink">
                {tenge(consultation.priceTiyn, locale)}
              </dd>
            </div>

            {confirmedAmountTiyn !== null ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm font-bold text-ink">
                  {t('confirmedPaymentAmount')}
                </dt>
                <dd className="shrink-0 text-xl font-extrabold tabular-nums text-ink">
                  {tenge(confirmedAmountTiyn, locale)}
                </dd>
              </div>
            ) : premiumPricing.kind === 'active' &&
              estimatedPremiumAmountTiyn !== null ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm font-bold text-ink">
                  {t('premiumEstimate', {
                    discount: premiumPricing.discountPercent,
                  })}
                </dt>
                <dd className="shrink-0 text-xl font-extrabold tabular-nums text-ink">
                  {tenge(estimatedPremiumAmountTiyn, locale)}
                </dd>
              </div>
            ) : null}
          </dl>

          {confirmedAmountTiyn === null && premiumPricing.kind === 'unknown' ? (
            <p className="mt-3 text-sm leading-6 text-amber-800">
              {t('priceEstimateUnavailable')}
            </p>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl bg-chip p-4 text-sm leading-6 text-body">
          <p className="font-bold text-ink">{t('holdTitle')}</p>
          <p>{t('holdBody')}</p>
          <p className="mt-2">{t('providerNotice')}</p>
        </div>
      </section>

      {phase === 'pending' ? (
        <section
          role="status"
          aria-live="polite"
          className="rounded-[20px] border border-border bg-white p-6"
        >
          <h2 className="font-extrabold text-ink">{t('pendingTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-body">{t('pendingBody')}</p>
        </section>
      ) : null}

      {phase === 'captured' || phase === 'voided' || phase === 'unavailable' ? (
        <section
          role="status"
          className="rounded-[20px] border border-border bg-white p-6"
        >
          <h2 className="font-extrabold text-ink">
            {phase === 'captured'
              ? t('capturedTitle')
              : phase === 'voided'
                ? t('voidedTitle')
                : t('unavailableTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-body">
            {message ??
              (phase === 'captured'
                ? t('capturedBody')
                : phase === 'voided'
                  ? t('voidedBody')
                  : t('notActive'))}
          </p>
          <Link
            href={consultationHref}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {t('returnToConsultation')}
          </Link>
        </section>
      ) : null}

      {phase !== 'pending' &&
      phase !== 'captured' &&
      phase !== 'voided' &&
      phase !== 'unavailable' ? (
        <form
          onSubmit={submit}
          aria-busy={phase === 'checking'}
          className="rounded-[20px] border border-border bg-white p-5 sm:p-6"
        >
          <h2 className="text-lg font-extrabold text-ink">
            {t('methodsTitle')}
          </h2>

          {methods === null && !methodsError ? (
            <div
              role="status"
              className="mt-4 space-y-3"
              aria-label={t('loadingMethods')}
            >
              <div className="h-14 animate-pulse rounded-2xl bg-surface motion-reduce:animate-none" />
              <p className="text-sm text-muted">{t('loadingMethods')}</p>
            </div>
          ) : null}

          {methodsError ? (
            <div className="mt-4">
              <p role="alert" className="text-sm font-semibold text-red-700">
                {t('methodsError')}
              </p>
              <button
                type="button"
                onClick={() => void loadMethods()}
                className="mt-2 min-h-11 rounded-xl px-2 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {t('retry')}
              </button>
            </div>
          ) : null}

          {methods?.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-surface p-4">
              <p className="font-bold text-ink">{t('emptyMethodsTitle')}</p>
              <p className="mt-1 text-sm leading-6 text-body">
                {t('emptyMethodsBody')}
              </p>
              <button
                type="button"
                onClick={() => void loadMethods()}
                className="mt-2 min-h-11 rounded-xl px-2 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {t('refreshMethods')}
              </button>
            </div>
          ) : null}

          {methods && methods.length > 0 ? (
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">{t('methodsTitle')}</legend>
              {methods.map((method) => (
                <label
                  key={method.id}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-chip"
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.id}
                    checked={selectedMethodId === method.id}
                    onChange={() => setSelectedMethodId(method.id)}
                    className="accent-primary"
                  />
                  <span className="font-semibold">{cardLabel(method)}</span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {phase === 'idle' && message ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
            >
              {message}
            </p>
          ) : null}

          {phase === 'declined' && message ? (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4"
            >
              <p className="font-bold text-red-800">{t('declinedTitle')}</p>
              <p className="mt-1 text-sm text-red-800">{message}</p>
            </div>
          ) : null}

          {phase === 'unknown' ? (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
            >
              <p className="font-bold text-amber-900">
                {t('statusUnknownTitle')}
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                {message ?? t('statusUnknown')}
              </p>
              <button
                type="button"
                onClick={() => void reconcile()}
                className="mt-2 min-h-11 rounded-xl px-2 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {t('checkStatus')}
              </button>
            </div>
          ) : null}

          {phase === 'checking' ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-4 text-sm text-body"
            >
              {t('checking')}
            </p>
          ) : null}

          {phase !== 'unknown' ? (
            <button
              type="submit"
              disabled={!canPay}
              className="mt-6 min-h-12 w-full rounded-2xl bg-primary px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {phase === 'checking' ? t('checking') : payLabel}
            </button>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
