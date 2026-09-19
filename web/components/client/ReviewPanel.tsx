'use client';

import Link from 'next/link';
import { journeyCopy } from './journey-copy';
import { useRef, useState } from 'react';
import type { components } from '@/lib/api/generated';
import { apiFetch, ApiError } from '@/lib/api/client';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';
import type { Consultation } from './ConsultationList';

type ReviewCreated = components['schemas']['ReviewCreatedDto'];
type Phase =
  'editing' | 'submitting' | 'success' | 'already' | 'unknown' | 'checking';

const MAX_TEXT_LENGTH = 2000;

const REVIEW_TAGS: Record<number, readonly string[]> = {
  1: ['not_helpful', 'long_wait', 'bad_connection'],
  2: ['little_use', 'did_not_understand', 'technical_issues'],
  3: ['average', 'could_be_better', 'standard'],
  4: ['attentive', 'helped_figure_out', 'professional'],
  5: ['attentive', 'helped_figure_out', 'exceeded_expectations'],
};

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function ReviewPanel({
  consultation,
  locale,
}: {
  consultation: Consultation;
  locale: string;
}) {
  const actionsCopy = journeyCopy(locale);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const deleteLock = useRef(false);
  const copy = locale === 'kz' ? kz.review : ru.review;
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [publicText, setPublicText] = useState('');
  const [privateText, setPrivateText] = useState('');
  const [phase, setPhase] = useState<Phase>(
    consultation.reviewId ? 'already' : 'editing',
  );
  const [saved, setSaved] = useState<ReviewCreated | null>(null);
  const [privateSubmitted, setPrivateSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const ratingLabels: Record<string, string> = {
    1: copy.rating1,
    2: copy.rating2,
    3: copy.rating3,
    4: copy.rating4,
    5: copy.rating5,
  };
  const tagLabels: Record<string, string> = {
    not_helpful: copy.tagNotHelpful,
    long_wait: copy.tagLongWait,
    bad_connection: copy.tagBadConnection,
    little_use: copy.tagLittleUse,
    did_not_understand: copy.tagDidNotUnderstand,
    technical_issues: copy.tagTechnicalIssues,
    average: copy.tagAverage,
    could_be_better: copy.tagCouldBeBetter,
    standard: copy.tagStandard,
    attentive: copy.tagAttentive,
    helped_figure_out: copy.tagHelpedFigureOut,
    professional: copy.tagProfessional,
    exceeded_expectations: copy.tagExceededExpectations,
  };

  const eligible =
    consultation.status === 'COMPLETED' && consultation.outcome === 'COMPLETED';
  if (!eligible) return null;

  function chooseRating(value: number) {
    if (phase !== 'editing') return;
    setRating(value);
    setTags([]);
    setError(null);
  }

  function toggleTag(tag: string) {
    if (phase !== 'editing') return;
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === 0 || phase !== 'editing' || submitLock.current) return;

    submitLock.current = true;
    setError(null);
    setPhase('submitting');

    const normalizedPublicText = optionalText(publicText);
    const normalizedPrivateText = optionalText(privateText);
    const body = {
      rating,
      ...(normalizedPublicText ? { publicText: normalizedPublicText } : {}),
      ...(normalizedPrivateText ? { privateText: normalizedPrivateText } : {}),
      ...(tags.length > 0 ? { tags } : {}),
    };

    try {
      const created = await apiFetch<ReviewCreated>(
        `consultations/${consultation.id}/review`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      if (!created) {
        setPhase('unknown');
        return;
      }
      setPrivateSubmitted(Boolean(normalizedPrivateText));
      setSaved(created);
      setPhase('success');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'REVIEW_EXISTS') {
        setPhase('already');
        return;
      }

      // Сетевой разрыв и 5xx могут случиться уже после фиксации отзыва.
      // Новый POST до GET-сверки дал бы человеку ложный конфликт.
      if (!(caught instanceof ApiError) || caught.status >= 500) {
        setPhase('unknown');
        return;
      }

      submitLock.current = false;
      setPhase('editing');
      setError(copy.saveError);
    }
  }

  async function reconcile() {
    if (phase !== 'unknown') return;
    setPhase('checking');
    setError(null);
    try {
      const current = await apiFetch<Consultation>(
        `consultations/${consultation.id}`,
      );
      if (
        !current ||
        (current.reviewId !== null &&
          (typeof current.reviewId !== 'string' ||
            current.reviewId.length === 0))
      ) {
        setPhase('unknown');
        setError(copy.checkError);
        return;
      }
      if (current.reviewId) {
        setPhase('already');
        return;
      }

      submitLock.current = false;
      setPhase('editing');
      setError(copy.notSaved);
    } catch {
      setPhase('unknown');
      setError(copy.checkError);
    }
  }

  async function removeReview() {
    if (deleteLock.current || !window.confirm(actionsCopy.reviewConfirm))
      return;
    deleteLock.current = true;
    setDeleting(true);
    setError(null);
    try {
      // Resolve the current ID even after REVIEW_EXISTS or a lost creation response.
      const current = await apiFetch<Consultation>(
        `consultations/${consultation.id}`,
      );
      if (!current || current.reviewId === undefined)
        throw new Error('Unknown review state');
      if (current.reviewId)
        await apiFetch(`reviews/${current.reviewId}`, { method: 'DELETE' });
      setDeleted(true);
    } catch {
      try {
        const fresh = await apiFetch<Consultation>(
          `consultations/${consultation.id}`,
        );
        if (fresh?.reviewId === null) setDeleted(true);
        else setError(actionsCopy.error);
      } catch {
        setError(actionsCopy.error);
      }
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  }

  const afterReview = (
    <div className="mt-5 flex flex-col items-start gap-3">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!deleted && (
        <button
          type="button"
          disabled={deleting}
          onClick={() => void removeReview()}
          className="min-h-11 rounded-xl border border-border px-4 font-bold text-primary disabled:opacity-50"
        >
          {deleting ? actionsCopy.loading : actionsCopy.reviewDelete}
        </button>
      )}
      <Link
        className="inline-flex min-h-11 items-center font-bold text-primary underline"
        href={`/${locale}/consultations/book/${consultation.expert.id}`}
      >
        {actionsCopy.again}
      </Link>
    </div>
  );
  if (deleted)
    return (
      <section className="rounded-[20px] border border-border p-5">
        <p role="status">{actionsCopy.reviewDeleted}</p>
        {afterReview}
      </section>
    );

  if (phase === 'already') {
    return (
      <section
        id="review"
        aria-labelledby="review-already-title"
        className="scroll-mt-20 rounded-[20px] border border-border bg-white p-5 sm:p-6"
      >
        <h2
          id="review-already-title"
          className="text-lg font-extrabold text-ink"
        >
          {copy.alreadyTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-body">{copy.alreadyBody}</p>
        {afterReview}
      </section>
    );
  }

  if (phase === 'success' && saved) {
    return (
      <section
        id="review"
        aria-labelledby="review-success-title"
        role="status"
        className="scroll-mt-20 rounded-[20px] border border-border bg-white p-5 sm:p-6"
      >
        <h2
          id="review-success-title"
          className="text-lg font-extrabold text-ink"
        >
          {copy.successTitle}
        </h2>
        <p className="mt-2 text-sm font-bold text-primary">
          {copy.savedRating.replace('{rating}', String(saved.rating))}
        </p>
        {saved.tags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label={copy.savedTags}>
            {saved.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-chip px-3 py-2 text-sm font-semibold text-ink"
              >
                {tagLabels[tag] ?? tag}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 rounded-2xl bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {copy.savedPublicTitle}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-body">
            {saved.publicText ?? copy.savedWithoutPublicText}
          </p>
        </div>
        {afterReview}
        {privateSubmitted ? (
          <p className="mt-4 text-sm leading-6 text-body">
            {copy.privateSubmitted}
          </p>
        ) : null}
      </section>
    );
  }

  if (phase === 'unknown' || phase === 'checking') {
    const checking = phase === 'checking';
    return (
      <section
        id="review"
        aria-labelledby="review-unknown-title"
        aria-busy={checking}
        className="scroll-mt-20 rounded-[20px] border border-border bg-white p-5 sm:p-6"
      >
        <h2
          id="review-unknown-title"
          className="text-lg font-extrabold text-ink"
        >
          {copy.unknownTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-body">{copy.unknownBody}</p>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void reconcile()}
          disabled={checking}
          className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {checking ? copy.checking : copy.checkReview}
        </button>
      </section>
    );
  }

  const availableTags = REVIEW_TAGS[rating] ?? [];

  return (
    <section
      id="review"
      aria-labelledby="review-title"
      className="scroll-mt-20 rounded-[20px] border border-border bg-white p-5 sm:p-6"
    >
      <p className="text-sm font-semibold text-primary">{copy.eyebrow}</p>
      <h2 id="review-title" className="mt-1 text-xl font-extrabold text-ink">
        {copy.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-body">{copy.intro}</p>

      <form
        className="mt-6"
        aria-busy={phase === 'submitting'}
        onSubmit={(event) => void submit(event)}
      >
        <fieldset>
          <legend className="font-bold text-ink">{copy.ratingLegend}</legend>
          <p id="review-rating-hint" className="mt-1 text-sm text-muted">
            {copy.ratingHint}
          </p>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-describedby="review-rating-hint"
          >
            {[1, 2, 3, 4, 5].map((value) => {
              const selected = rating === value;
              const label = ratingLabels[String(value)];
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={copy.starLabel
                    .replace('{rating}', String(value))
                    .replace('{label}', label)}
                  onClick={() => chooseRating(value)}
                  className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-border bg-white text-3xl leading-none text-amber-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 aria-pressed:border-primary aria-pressed:bg-chip"
                >
                  <span aria-hidden="true">{value <= rating ? '★' : '☆'}</span>
                </button>
              );
            })}
          </div>
          {rating > 0 ? (
            <p
              className="mt-2 text-sm font-bold text-primary"
              aria-live="polite"
            >
              {ratingLabels[String(rating)]}
            </p>
          ) : null}
        </fieldset>

        {availableTags.length > 0 ? (
          <fieldset className="mt-6">
            <legend className="font-bold text-ink">{copy.tagsLegend}</legend>
            <p className="mt-1 text-sm text-muted">{copy.tagsHint}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={tags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                  className="min-h-11 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 aria-pressed:border-primary aria-pressed:bg-chip aria-pressed:text-primary"
                >
                  {tagLabels[tag]}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="mt-6">
          <label htmlFor="review-public" className="font-bold text-ink">
            {copy.publicLabel}
          </label>
          <p id="review-public-hint" className="mt-1 text-sm text-muted">
            {copy.publicHint}
          </p>
          <textarea
            id="review-public"
            value={publicText}
            disabled={phase === 'submitting'}
            maxLength={MAX_TEXT_LENGTH}
            rows={4}
            aria-describedby="review-public-hint review-public-count"
            onChange={(event) => {
              setPublicText(event.target.value);
              setError(null);
            }}
            className="mt-3 w-full resize-y rounded-2xl border border-border bg-white px-4 py-3 text-base text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <p
            id="review-public-count"
            className="mt-1 text-right text-xs text-muted"
          >
            {publicText.length}/{MAX_TEXT_LENGTH}
          </p>
        </div>

        <div className="mt-5">
          <label htmlFor="review-private" className="font-bold text-ink">
            {copy.privateLabel}
          </label>
          <p id="review-private-hint" className="mt-1 text-sm text-muted">
            {copy.privateHint}
          </p>
          <textarea
            id="review-private"
            value={privateText}
            disabled={phase === 'submitting'}
            maxLength={MAX_TEXT_LENGTH}
            rows={4}
            aria-describedby="review-private-hint review-private-count"
            onChange={(event) => {
              setPrivateText(event.target.value);
              setError(null);
            }}
            className="mt-3 w-full resize-y rounded-2xl border border-border bg-white px-4 py-3 text-base text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <p
            id="review-private-count"
            className="mt-1 text-right text-xs text-muted"
          >
            {privateText.length}/{MAX_TEXT_LENGTH}
          </p>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={rating === 0 || phase === 'submitting'}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {phase === 'submitting' ? copy.sending : copy.submit}
        </button>
      </form>
      {phase !== 'submitting' && (
        <Link
          className="mt-4 inline-flex min-h-11 items-center font-bold text-primary underline"
          href={`/${locale}/consultations/book/${consultation.expert.id}`}
        >
          {actionsCopy.again}
        </Link>
      )}
    </section>
  );
}
