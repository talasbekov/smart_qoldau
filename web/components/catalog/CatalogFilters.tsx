import type { Topic } from '@/lib/api/public';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

export type Selected = {
  topic?: string;
  language?: string;
  format?: string;
  sort?: string;
};

const SELECT_CLASS =
  'h-11 rounded-2xl border border-border bg-white px-4 text-[13px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary';

function Field({
  name,
  label,
  value,
  anyLabel,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  anyLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      {/* Прототип рисует списки без подписей. Подписи добавлены: поле без
          неё непонятно скринридеру и человеку, вернувшемуся к странице
          через час. Расхождение №13. */}
      <label htmlFor={`filter-${name}`} className="text-xs font-semibold text-muted">
        {label}
      </label>
      <select id={`filter-${name}`} name={name} defaultValue={value ?? ''} className={SELECT_CLASS}>
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Обычная форма с методом GET: фильтры остаются в адресе, выборку можно
// переслать и открыть заново, поисковик её обходит, и всё это работает
// без единой строки скриптов. Прототип рисует переход по onChange —
// поведение сохранено ниже прогрессивным улучшением, но не ценой того,
// что без JS каталог перестаёт фильтроваться.
export default function CatalogFilters({
  topics,
  selected,
  action,
  locale = 'ru',
}: {
  topics: Topic[];
  selected: Selected;
  action: string;
  locale?: string;
}) {
  const copy = locale === 'kz' ? kz.catalog : ru.catalog;
  const formats = [
    { value: 'chat', label: copy.formatChat },
    { value: 'audio', label: copy.formatAudio },
    { value: 'video', label: copy.formatVideo },
  ];
  const languages = [
    { value: 'ru', label: copy.languageRussian },
    { value: 'kz', label: copy.languageKazakh },
    { value: 'en', label: copy.languageEnglish },
  ];
  const sorts = [
    { value: 'rating', label: copy.sortRating },
    { value: 'price_asc', label: copy.sortPriceAsc },
    { value: 'price_desc', label: copy.sortPriceDesc },
  ];
  return (
    <form method="get" action={action} className="mb-7 flex flex-wrap items-end gap-2.5">
      <Field
        name="topic"
        label={copy.specialization}
        value={selected.topic}
        anyLabel={copy.allSpecializations}
        options={topics.map((topic) => ({ value: topic.slug, label: topic.name }))}
      />
      <Field name="format" label={copy.filters.format} value={selected.format} anyLabel={copy.anyFormat} options={formats} />
      <Field name="language" label={copy.filters.language} value={selected.language} anyLabel={copy.anyLanguage} options={languages} />
      <Field name="sort" label={copy.filters.sort} value={selected.sort} anyLabel={copy.defaultSort} options={sorts} />
      <button
        type="submit"
        className="h-11 rounded-2xl bg-primary px-5 text-[13px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {copy.show}
      </button>
    </form>
  );
}
