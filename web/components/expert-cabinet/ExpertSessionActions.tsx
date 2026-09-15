'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api/client';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type Outcome =
  | 'COMPLETED'
  | 'CLIENT_NO_SHOW'
  | 'CLIENT_CANCELLED'
  | 'TECH_ISSUE';

type PaymentStatus = 'UNPAID' | 'HELD' | 'CAPTURED' | 'VOIDED' | 'FAILED';
type ExpertNote = { text: string | null; updatedAt?: string };
type CompleteResult = {
  status: 'COMPLETED';
  outcome: Outcome;
  paymentStatus: PaymentStatus;
};
type ConsultationSnapshot = {
  status: string;
  outcome?: string | null;
  paymentStatus: PaymentStatus;
};

const OUTCOMES: Outcome[] = [
  'COMPLETED',
  'CLIENT_NO_SHOW',
  'CLIENT_CANCELLED',
  'TECH_ISSUE',
];
const PAYMENT_STATUSES: PaymentStatus[] = [
  'UNPAID',
  'HELD',
  'CAPTURED',
  'VOIDED',
  'FAILED',
];

export default function ExpertSessionActions({
  consultationId,
  locale = 'ru',
  active,
  initialPaymentStatus,
}: {
  consultationId: string;
  locale?: string;
  active: boolean;
  initialPaymentStatus: PaymentStatus;
}) {
  const copy = locale === 'kz' ? kz.expertSession : ru.expertSession;
  const router = useRouter();
  const mountedRef = useRef(true);
  const saveLock = useRef(false);
  const completeLock = useRef(false);
  const noteRef = useRef('');
  const [note, setNote] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [notePhase, setNotePhase] = useState<
    'loading' | 'load-error' | 'idle' | 'saving' | 'saved' | 'error'
  >('loading');
  const [outcome, setOutcome] = useState<Outcome>('COMPLETED');
  const [completePhase, setCompletePhase] = useState<
    | 'idle'
    | 'confirm'
    | 'submitting'
    | 'reconciling'
    | 'uncertain'
    | 'retryable'
    | 'error'
    | 'success'
  >('idle');
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [resultOutcome, setResultOutcome] = useState<Outcome | null>(null);
  const [resultPaymentStatus, setResultPaymentStatus] =
    useState<PaymentStatus | null>(null);

  const loadNote = useCallback(async () => {
    setNotePhase('loading');
    try {
      const result = await apiFetch<ExpertNote>(
        `consultations/${consultationId}/note`,
      );
      if (!mountedRef.current) return;
      const text = result?.text ?? '';
      noteRef.current = text;
      setNote(text);
      setSavedNote(text);
      setNotePhase('idle');
    } catch {
      if (mountedRef.current) setNotePhase('load-error');
    }
  }, [consultationId]);

  useEffect(() => {
    mountedRef.current = true;
    void loadNote();

    return () => {
      mountedRef.current = false;
    };
  }, [loadNote]);

  const outcomeLabels: Record<Outcome, string> = {
    COMPLETED: copy.outcomeCompleted,
    CLIENT_NO_SHOW: copy.outcomeNoShow,
    CLIENT_CANCELLED: copy.outcomeClientCancelled,
    TECH_ISSUE: copy.outcomeTechIssue,
  };

  async function saveNote() {
    const trimmed = note.trim();
    if (!trimmed || saveLock.current) return;
    saveLock.current = true;
    setNotePhase('saving');
    try {
      const saved = await apiFetch<ExpertNote>(
        `consultations/${consultationId}/note`,
        {
          method: 'PUT',
          body: JSON.stringify({ text: trimmed }),
        },
      );
      if (!mountedRef.current) return;
      const confirmed = saved?.text ?? trimmed;
      setSavedNote(confirmed);
      if (noteRef.current === trimmed) {
        noteRef.current = confirmed;
        setNote(confirmed);
        setNotePhase('saved');
      } else {
        // Ответ относится к отправленному snapshot. Более свежий draft
        // остаётся в поле и по-прежнему требует сохранения.
        setNotePhase('idle');
      }
    } catch {
      if (mountedRef.current) setNotePhase('error');
    } finally {
      saveLock.current = false;
    }
  }

  function startConfirmation(event: React.FormEvent) {
    event.preventDefault();
    setCompleteError(null);
    setCompletePhase('confirm');
  }

  function completionError(caught: unknown): string {
    if (!(caught instanceof ApiError)) return copy.completeError;
    if (caught.code === 'INVALID_OUTCOME') return copy.invalidOutcome;
    if (caught.code === 'PAYMENT_HOLD_REQUIRED') return copy.holdRequired;
    return copy.completeError;
  }

  function isOutcome(value: unknown): value is Outcome {
    return OUTCOMES.includes(value as Outcome);
  }

  function isPaymentStatus(value: unknown): value is PaymentStatus {
    return PAYMENT_STATUSES.includes(value as PaymentStatus);
  }

  function applyConfirmedCompletion(confirmed: CompleteResult) {
    setOutcome(confirmed.outcome);
    setResultOutcome(confirmed.outcome);
    setResultPaymentStatus(confirmed.paymentStatus);
    setCompleteError(null);
    setCompletePhase('success');
    router.refresh();
  }

  async function reconcileCompletion() {
    setCompleteError(null);
    setCompletePhase('reconciling');
    try {
      const current = await apiFetch<ConsultationSnapshot>(
        `consultations/${consultationId}`,
      );
      if (!mountedRef.current) return;
      if (
        current?.status === 'COMPLETED' &&
        isOutcome(current.outcome) &&
        isPaymentStatus(current.paymentStatus)
      ) {
        applyConfirmedCompletion({
          status: 'COMPLETED',
          outcome: current.outcome,
          paymentStatus: current.paymentStatus,
        });
        return;
      }
      if (
        current?.status === 'ACTIVE' &&
        current.outcome == null &&
        current.paymentStatus === 'HELD'
      ) {
        setCompleteError(copy.completionActive);
        setCompletePhase('retryable');
        return;
      }
      setCompleteError(copy.completionNotConfirmed);
      setCompletePhase('uncertain');
    } catch {
      if (!mountedRef.current) return;
      setCompleteError(copy.completionUnknown);
      setCompletePhase('uncertain');
    }
  }

  async function checkCompletionStatus() {
    if (completeLock.current) return;
    completeLock.current = true;
    try {
      await reconcileCompletion();
    } finally {
      completeLock.current = false;
    }
  }

  async function complete() {
    if (completeLock.current) return;
    completeLock.current = true;
    setCompleteError(null);
    setCompletePhase('submitting');
    try {
      const confirmed = await apiFetch<CompleteResult>(
        `consultations/${consultationId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({ outcome }),
        },
      );
      if (!mountedRef.current) return;
      if (!confirmed || confirmed.status !== 'COMPLETED') {
        throw new Error('Completion was not confirmed');
      }
      applyConfirmedCompletion(confirmed);
    } catch (caught) {
      if (!mountedRef.current) return;
      if (
        caught instanceof ApiError &&
        (caught.code === 'INVALID_OUTCOME' ||
          caught.code === 'PAYMENT_HOLD_REQUIRED')
      ) {
        setCompleteError(completionError(caught));
        setCompletePhase('error');
      } else {
        await reconcileCompletion();
      }
    } finally {
      completeLock.current = false;
    }
  }

  function settlementCopy(status: PaymentStatus): string {
    switch (status) {
      case 'CAPTURED':
        return copy.settlementCaptured;
      case 'VOIDED':
        return copy.settlementVoided;
      case 'HELD':
        return copy.settlementHeld;
      case 'FAILED':
        return copy.settlementFailed;
      case 'UNPAID':
        return copy.settlementUnpaid;
      default:
        return copy.settlementUnknown.replace('{status}', status);
    }
  }

  const noteChanged = note.trim() !== savedNote && note.trim().length > 0;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="min-w-0 rounded-[20px] border border-border bg-white p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-ink">{copy.noteTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{copy.notePrivacy}</p>

        {notePhase === 'loading' ? (
          <p role="status" className="mt-5 text-sm text-muted">
            {copy.noteLoading}
          </p>
        ) : notePhase === 'load-error' ? (
          <div className="mt-5">
            <p role="alert" className="text-sm font-semibold text-red-700">
              {copy.noteLoadError}
            </p>
            <button
              type="button"
              onClick={() => void loadNote()}
              className="mt-4 min-h-12 rounded-2xl border border-border bg-white px-4 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {copy.retryLoad}
            </button>
          </div>
        ) : (
          <>
            <label
              htmlFor="expert-session-note"
              className="mt-5 block text-xs font-semibold text-muted"
            >
              {copy.noteLabel}
            </label>
            <textarea
              id="expert-session-note"
              value={note}
              onChange={(event) => {
                noteRef.current = event.target.value;
                setNote(event.target.value);
                if (notePhase === 'saved' || notePhase === 'error') {
                  setNotePhase('idle');
                }
              }}
              maxLength={5000}
              rows={7}
              placeholder={copy.notePlaceholder}
              className="mt-2 w-full resize-y rounded-2xl border border-border p-4 text-base leading-6 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted">
              <span>{note.length} / 5000</span>
              {notePhase === 'saved' ? (
                <span role="status" aria-live="polite" className="font-semibold text-primary">
                  {copy.noteSaved}
                </span>
              ) : null}
            </div>

            {notePhase === 'error' ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
                {copy.noteSaveError}
              </p>
            ) : null}

            <button
              type="button"
              disabled={!noteChanged || notePhase === 'saving'}
              onClick={() => void saveNote()}
              className="mt-4 min-h-12 rounded-2xl bg-primary px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {notePhase === 'saving'
                ? copy.savingNote
                : notePhase === 'error'
                  ? copy.retrySave
                  : copy.saveNote}
            </button>
          </>
        )}
      </section>

      <section className="min-w-0 rounded-[20px] border border-border bg-white p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-ink">{copy.finishTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-body">{copy.finishHint}</p>

        {completePhase === 'success' && resultPaymentStatus && resultOutcome ? (
          <div className="mt-5">
            <h3 className="font-extrabold text-ink">{copy.completedTitle}</h3>
            <p className="mt-2 text-sm font-semibold text-ink">
              {copy.confirmedOutcome}: {outcomeLabels[resultOutcome]}
            </p>
            <p
              role="status"
              aria-live="polite"
              className="mt-3 rounded-2xl bg-chip p-4 text-sm leading-6 text-body"
            >
              {settlementCopy(resultPaymentStatus)}
            </p>
          </div>
        ) : !active ? (
          <p className="mt-5 rounded-2xl bg-chip p-4 text-sm text-body">
            {copy.inactive}
          </p>
        ) : completePhase === 'idle' ? (
          <form onSubmit={startConfirmation} className="mt-5">
            <label
              htmlFor="consultation-outcome"
              className="block text-xs font-semibold text-muted"
            >
              {copy.outcomeLabel}
            </label>
            <select
              id="consultation-outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as Outcome)}
              className="mt-2 h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {OUTCOMES.map((value) => (
                <option key={value} value={value}>
                  {outcomeLabels[value]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="mt-4 min-h-12 rounded-2xl bg-red-700 px-5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2"
            >
              {copy.finish}
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-2xl bg-chip p-4">
            <h3 className="font-extrabold text-ink">{copy.confirmTitle}</h3>
            <p className="mt-2 font-semibold text-ink">{outcomeLabels[outcome]}</p>
            {completePhase !== 'uncertain' &&
            completePhase !== 'reconciling' &&
            completePhase !== 'retryable' ? (
              <p className="mt-2 text-sm leading-6 text-body">
                {outcome === 'COMPLETED'
                  ? copy.confirmCompleted
                  : copy.confirmUnsuccessful}
              </p>
            ) : null}

            {completeError ? (
              <p
                role={completePhase === 'retryable' ? 'status' : 'alert'}
                className={`mt-3 text-sm font-semibold ${
                  completePhase === 'retryable' ? 'text-body' : 'text-red-700'
                }`}
              >
                {completeError}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              {completePhase === 'uncertain' || completePhase === 'reconciling' ? (
                <button
                  type="button"
                  disabled={completePhase === 'reconciling'}
                  onClick={() => void checkCompletionStatus()}
                  className="min-h-12 rounded-2xl bg-primary px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  {completePhase === 'reconciling'
                    ? copy.checkingStatus
                    : copy.checkStatus}
                </button>
              ) : completePhase === 'retryable' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void checkCompletionStatus()}
                    className="min-h-12 rounded-2xl border border-border bg-white px-4 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {copy.checkStatus}
                  </button>
                  <button
                    type="button"
                    onClick={() => void complete()}
                    className="min-h-12 rounded-2xl bg-red-700 px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2"
                  >
                    {copy.retryFinish}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={completePhase === 'submitting'}
                    onClick={() => {
                      setCompleteError(null);
                      setCompletePhase('idle');
                    }}
                    className="min-h-12 rounded-2xl border border-border bg-white px-4 text-sm font-bold text-ink disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {copy.back}
                  </button>
                  <button
                    type="button"
                    disabled={completePhase === 'submitting'}
                    onClick={() => void complete()}
                    className="min-h-12 rounded-2xl bg-red-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2"
                  >
                    {completePhase === 'submitting'
                      ? copy.completing
                      : completePhase === 'error'
                        ? copy.retryFinish
                        : copy.confirmFinish}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <p className="mt-4 text-xs leading-5 text-muted">
          {copy.currentPaymentStatus.replace(
            '{status}',
            resultPaymentStatus ?? initialPaymentStatus,
          )}
        </p>
      </section>
    </div>
  );
}
