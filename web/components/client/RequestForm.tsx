'use client';

import Link from 'next/link';
import { journeyCopy } from './journey-copy';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api/client';
import type { Topic } from '@/lib/api/public';

export default function RequestForm({
  topics,
  locale,
}: {
  topics: Topic[];
  locale: string;
}) {
  const router = useRouter();
  const copy = journeyCopy(locale);
  const formats = [
    { value: 'chat', label: copy.chat },
    { value: 'audio', label: copy.audio },
    { value: 'video', label: copy.video },
  ] as const;
  const lock = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  async function recover(): Promise<boolean> {
    const current = await apiFetch<{
      id: string;
      status: string;
      consultationId?: string;
    }>('requests/current');
    if (current?.id) {
      router.replace(
        current.status === 'MATCHED' && current.consultationId
          ? `/${locale}/consultations/${current.consultationId}`
          : `/${locale}/requests/${current.id}`,
      );
      return true;
    }
    return false;
  }

  async function checkCurrent() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (!(await recover())) {
        setUncertain(false);
        setError(copy.noCurrent);
      }
    } catch {
      setError(copy.requestError);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const [topicSlug, setTopicSlug] = useState('');
  const [format, setFormat] = useState<'chat' | 'audio' | 'video'>('chat');
  const [isEmergency, setEmergency] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || uncertain) return;
    if (!topicSlug) {
      setError(copy.choose);
      return;
    }
    lock.current = true;
    setError(null);
    setBusy(true);
    setShowCatalog(false);
    let attempted = false;
    try {
      if (await recover()) return;
      attempted = true;
      const created = await apiFetch<{ id: string }>('requests', {
        method: 'POST',
        body: JSON.stringify({ topicSlug, format, isEmergency }),
      });
      if (!created?.id) throw new Error('Missing request id');
      router.replace(`/${locale}/requests/${created.id}`);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : null;
      const ambiguous =
        attempted &&
        (!(caught instanceof ApiError) ||
          caught.status >= 500 ||
          code === 'ACTIVE_REQUEST_EXISTS');
      if (ambiguous) {
        setUncertain(true);
        try {
          if (await recover()) return;
          setError(copy.noCurrent);
        } catch {
          setError(copy.requestError);
        }
      } else {
        setError(
          code === 'AUTO_MATCH_DISABLED'
            ? copy.autoDisabled
            : code === 'REQUEST_RATE_LIMITED' ||
                (caught instanceof ApiError && caught.status === 429)
              ? copy.rate
              : code === 'VALIDATION_FAILED'
                ? copy.invalid
                : copy.requestError,
        );
        setShowCatalog(code === 'AUTO_MATCH_DISABLED');
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-6">
      <div>
        <label
          htmlFor="topic"
          className="mb-1 block text-xs font-semibold text-muted"
        >
          {copy.topic}
        </label>
        <select
          id="topic"
          value={topicSlug}
          onChange={(e) => setTopicSlug(e.target.value)}
          className="h-12 w-full rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">{copy.choose}</option>
          {topics.map((topic) => (
            <option key={topic.slug} value={topic.slug}>
              {topic.name}
            </option>
          ))}
        </select>
      </div>

      {/* Радиогруппа, а не список кнопок: выбор один из трёх, и с
          клавиатуры он должен переключаться стрелками. */}
      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-muted">
          {copy.format}
        </legend>
        <div className="flex gap-2">
          {formats.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-ink has-[:checked]:border-primary has-[:checked]:bg-chip"
            >
              <input
                type="radio"
                name="format"
                value={option.value}
                checked={format === option.value}
                onChange={() => setFormat(option.value)}
                className="accent-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-2xl bg-chip p-4">
        <input
          type="checkbox"
          checked={isEmergency}
          onChange={(e) => setEmergency(e.target.checked)}
          className="mt-1 accent-primary"
        />
        <span className="text-sm text-body">
          <span className="font-bold text-ink">{copy.urgent}</span>
          <br />
          {copy.urgentBody}
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {showCatalog && (
        <Link
          className="font-bold text-primary underline"
          href={`/${locale}/catalog`}
        >
          {copy.catalog}
        </Link>
      )}
      {uncertain && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void checkCurrent()}
            className="min-h-11 rounded-xl border border-border px-4"
          >
            {copy.retry}
          </button>
          <Link
            className="text-primary underline"
            href={`/${locale}/consultations`}
          >
            {copy.requests}
          </Link>
        </div>
      )}
      <button
        type="submit"
        disabled={busy || uncertain}
        className="h-12 rounded-2xl bg-primary text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {busy ? copy.finding : copy.find}
      </button>
    </form>
  );
}
