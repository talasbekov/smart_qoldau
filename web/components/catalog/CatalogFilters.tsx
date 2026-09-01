import type { Topic } from '@/lib/api/public';

export type Selected = {
  topic?: string;
  language?: string;
  format?: string;
  sort?: string;
};

const FORMATS = [
  { value: 'chat', label: 'Чат' },
  { value: 'audio', label: 'Аудио' },
  { value: 'video', label: 'Видео' },
];

const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'kz', label: 'Қазақша' },
  { value: 'en', label: 'English' },
];

const SORTS = [
  { value: 'rating', label: 'По рейтингу' },
  { value: 'price_asc', label: 'Сначала дешевле' },
  { value: 'price_desc', label: 'Сначала дороже' },
];

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
}: {
  topics: Topic[];
  selected: Selected;
  action: string;
}) {
  return (
    <form method="get" action={action} className="mb-7 flex flex-wrap items-end gap-2.5">
      <Field
        name="topic"
        label="Специализация"
        value={selected.topic}
        anyLabel="Все специализации"
        options={topics.map((topic) => ({ value: topic.slug, label: topic.name }))}
      />
      <Field name="format" label="Формат" value={selected.format} anyLabel="Любой формат" options={FORMATS} />
      <Field name="language" label="Язык" value={selected.language} anyLabel="Любой язык" options={LANGUAGES} />
      <Field name="sort" label="Сортировка" value={selected.sort} anyLabel="По умолчанию" options={SORTS} />
      <button
        type="submit"
        className="h-11 rounded-2xl bg-primary px-5 text-[13px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Показать
      </button>
    </form>
  );
}
