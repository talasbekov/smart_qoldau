'use client';

import { useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api/client';
import { expertCopy } from './copy';
import type { ExpertMe, Topic } from './types';

type FormValues = {
  displayName: string; city: string; experience: string; education: string;
  price: string; languages: string[]; formats: string[]; topicSlugs: string[];
};

function valuesFor(expert?: ExpertMe): FormValues {
  return {
    displayName: expert?.displayName ?? '', city: expert?.city ?? 'Астана',
    experience: expert?.experience ?? 'ONE_TO_THREE', education: expert?.education ?? '',
    price: expert ? String(expert.priceTiyn / 100) : '', languages: expert?.languages ?? ['ru'],
    formats: expert?.formats ?? ['video'], topicSlugs: expert?.topicSlugs ?? [],
  };
}

function toggle(items: string[], value: string): string[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

export default function ApplicationForm({
  locale, topics, expert, onSaved,
}: {
  locale: string; topics: Topic[]; expert?: ExpertMe; onSaved: (expert: ExpertMe) => void;
}) {
  const copy = expertCopy(locale);
  const [values, setValues] = useState(() => valuesFor(expert));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof FormValues, value: string | string[]) => setValues((old) => ({ ...old, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(values.price.replace(',', '.'));
    if (!values.displayName.trim() || !values.education.trim() || !Number.isFinite(price) || price < 2000 || price > 15000 || !values.topicSlugs.length || !values.languages.length || !values.formats.length) {
      setError(copy.validation); return;
    }
    setSaving(true); setError(null);
    try {
      const body = {
        displayName: values.displayName.trim(), city: values.city, experience: values.experience,
        education: values.education.trim(), priceTiyn: Math.round(price * 100),
        languages: values.languages, formats: values.formats, topicSlugs: values.topicSlugs,
      };
      const saved = await apiFetch<ExpertMe>(expert ? 'experts/me' : 'experts', {
        method: expert ? 'PATCH' : 'POST', body: JSON.stringify(body),
      });
      if (!saved) throw new Error('empty response');
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof ApiError && caught.code === 'EXPERT_EXISTS'
        ? copy.existingTitle : copy.genericError);
    } finally { setSaving(false); }
  }

  const chips = (items: readonly string[], selected: string[], label: (item: string) => string, onChange: (item: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => <label key={item} className={`cursor-pointer rounded-full border px-3 py-2 text-sm font-semibold ${selected.includes(item) ? 'border-primary bg-primary text-white' : 'border-border bg-white text-ink'}`}>
        <input className="sr-only" type="checkbox" checked={selected.includes(item)} onChange={() => onChange(item)} />{label(item)}
      </label>)}
    </div>
  );

  return <form onSubmit={submit} className="flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-white p-5 sm:p-7">
    {error && <p role="alert" className="rounded-xl bg-[#fdece3] p-3 text-sm font-semibold text-[#8a3a2e]">{error}</p>}
    <label className="flex flex-col gap-2 text-sm font-bold text-ink">{copy.fields.displayName}<input required maxLength={100} value={values.displayName} onChange={(e) => set('displayName', e.target.value)} className="min-h-11 rounded-xl border border-border px-3 text-body outline-none focus:ring-2 focus:ring-primary" /></label>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-bold text-ink">{copy.fields.city}<select value={values.city} onChange={(e) => set('city', e.target.value)} className="min-h-11 rounded-xl border border-border bg-white px-3 text-body outline-none focus:ring-2 focus:ring-primary">{copy.cities.map((city) => <option key={city}>{city}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm font-bold text-ink">{copy.fields.experience}<select value={values.experience} onChange={(e) => set('experience', e.target.value)} className="min-h-11 rounded-xl border border-border bg-white px-3 text-body outline-none focus:ring-2 focus:ring-primary">{Object.entries(copy.experience).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <label className="flex flex-col gap-2 text-sm font-bold text-ink">{copy.fields.education}<textarea required minLength={2} maxLength={500} value={values.education} onChange={(e) => set('education', e.target.value)} className="min-h-24 rounded-xl border border-border p-3 text-body outline-none focus:ring-2 focus:ring-primary" /></label>
    <label className="flex flex-col gap-2 text-sm font-bold text-ink">{copy.fields.price}<input required type="number" min="2000" max="15000" step="1" inputMode="decimal" value={values.price} onChange={(e) => set('price', e.target.value)} className="min-h-11 rounded-xl border border-border px-3 text-body outline-none focus:ring-2 focus:ring-primary" /></label>
    <fieldset className="flex flex-col gap-2"><legend className="mb-2 text-sm font-bold text-ink">{copy.fields.topics}</legend>{topics.length ? chips(topics.map((topic) => topic.slug), values.topicSlugs, (slug) => topics.find((topic) => topic.slug === slug)?.name ?? slug, (slug) => set('topicSlugs', toggle(values.topicSlugs, slug))) : <p className="text-sm text-muted">{copy.genericError}</p>}</fieldset>
    <fieldset><legend className="mb-2 text-sm font-bold text-ink">{copy.fields.languages}</legend>{chips(['ru', 'kz', 'en'], values.languages, (item) => copy.languages[item] ?? item, (item) => set('languages', toggle(values.languages, item)))}</fieldset>
    <fieldset><legend className="mb-2 text-sm font-bold text-ink">{copy.fields.formats}</legend>{chips(['chat', 'audio', 'video'], values.formats, (item) => copy.formats[item] ?? item, (item) => set('formats', toggle(values.formats, item)))}</fieldset>
    <button disabled={saving} className="min-h-11 self-start rounded-full bg-primary px-5 font-bold text-white disabled:opacity-60">{saving ? copy.saving : expert ? copy.save : copy.documents}</button>
  </form>;
}
