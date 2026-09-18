import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createContent,
  listContent,
  patchContent,
  uploadContentAudio,
  type ContentAccess,
  type ContentItem,
  type ContentKind,
  type NewContentItem,
} from '@/lib/content';

const inputClass =
  'w-full rounded-lg border border-sq-border bg-white px-3 py-2 text-sm focus:border-sq-primary focus:outline-none focus:ring-2 focus:ring-sq-primary/20';
const labelClass = 'mb-1 block text-sm font-semibold text-sq-text';
const helpClass = 'mt-1 text-xs leading-5 text-sq-text-secondary';

type FormState = {
  kind: ContentKind;
  access: ContentAccess;
  slug: string;
  category: string;
  titleRu: string;
  titleKk: string;
  summaryRu: string;
  summaryKk: string;
  markdownRu: string;
  markdownKk: string;
  phases: string;
  cycles: string;
  durationSec: string;
  coverKey: string;
  sortOrder: string;
  published: boolean;
};

const EMPTY_FORM: FormState = {
  kind: 'ARTICLE',
  access: 'FREE',
  slug: '',
  category: '',
  titleRu: '',
  titleKk: '',
  summaryRu: '',
  summaryKk: '',
  markdownRu: '',
  markdownKk: '',
  phases: '',
  cycles: '1',
  durationSec: '',
  coverKey: '',
  sortOrder: '0',
  published: false,
};

function phasesToText(payload: Record<string, unknown>): string {
  if (!Array.isArray(payload.phases)) return '';
  return payload.phases
    .map((phase) => {
      const value = phase as {
        nameRu?: unknown;
        nameKk?: unknown;
        seconds?: unknown;
      };
      return `${String(value.nameRu ?? '')} | ${String(value.nameKk ?? '')} | ${String(value.seconds ?? '')}`;
    })
    .join('\n');
}

function itemToForm(item: ContentItem): FormState {
  return {
    kind: item.kind,
    access: item.access,
    slug: item.slug,
    category: item.category,
    titleRu: item.titleRu,
    titleKk: item.titleKk,
    summaryRu: item.summaryRu,
    summaryKk: item.summaryKk,
    markdownRu:
      typeof item.payload.markdownRu === 'string'
        ? item.payload.markdownRu
        : '',
    markdownKk:
      typeof item.payload.markdownKk === 'string'
        ? item.payload.markdownKk
        : '',
    phases: phasesToText(item.payload),
    cycles:
      typeof item.payload.cycles === 'number'
        ? String(item.payload.cycles)
        : '1',
    durationSec: item.durationSec == null ? '' : String(item.durationSec),
    coverKey: item.coverKey ?? '',
    sortOrder: String(item.sortOrder),
    published: item.publishedAt !== null,
  };
}

function parsePhases(
  value: string,
): Array<{ nameRu: string; nameKk: string; seconds: number }> | null {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const phases = lines.map((line) => {
    const [nameRu = '', nameKk = '', secondsText = ''] = line
      .split('|')
      .map((part) => part.trim());
    return { nameRu, nameKk, seconds: Number(secondsText) };
  });
  return phases.every(
    (phase) =>
      phase.nameRu &&
      phase.nameKk &&
      Number.isFinite(phase.seconds) &&
      phase.seconds > 0,
  )
    ? phases
    : null;
}

function payloadFor(form: FormState): Record<string, unknown> | null {
  if (form.kind === 'ARTICLE') {
    return { markdownRu: form.markdownRu, markdownKk: form.markdownKk };
  }
  if (form.kind === 'MEDITATION' || form.kind === 'MUSIC') {
    return {};
  }
  const phases = parsePhases(form.phases);
  const cycles = Number(form.cycles);
  return phases && Number.isInteger(cycles) && cycles > 0
    ? { phases, cycles }
    : null;
}

function validationError(form: FormState, editing: boolean): string | null {
  if (!editing && !/^[a-z0-9-]{3,120}$/.test(form.slug)) {
    return 'Slug: от 3 до 120 латинских строчных букв, цифр или дефисов.';
  }
  if (
    !editing &&
    (form.category.trim().length < 2 || form.category.trim().length > 64)
  ) {
    return 'Категория должна содержать от 2 до 64 символов.';
  }
  if (
    form.titleRu.trim().length < 2 ||
    form.titleRu.length > 200 ||
    form.titleKk.trim().length < 2 ||
    form.titleKk.length > 200
  ) {
    return 'Оба заголовка обязательны: от 2 до 200 символов каждый.';
  }
  if (form.summaryRu.length > 500 || form.summaryKk.length > 500) {
    return 'Каждое краткое описание должно быть не длиннее 500 символов.';
  }
  const order = Number(form.sortOrder);
  if (!Number.isInteger(order) || order < 0)
    return 'Порядок должен быть целым числом от 0.';
  if (!editing && form.durationSec !== '') {
    const duration = Number(form.durationSec);
    if (!Number.isInteger(duration) || duration < 0 || duration > 86_400) {
      return 'Длительность должна быть целым числом от 0 до 86400 секунд.';
    }
  }
  if (!payloadFor(form)) {
    return 'Заполните хотя бы одну фазу в формате «Название RU | Атауы KK | секунды» и укажите положительное число циклов.';
  }
  return null;
}

export default function ContentEditorPage() {
  const { id } = useParams();
  const editing = id !== undefined;
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [currentItem, setCurrentItem] = useState<ContentItem | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    editing ? 'loading' : 'ready',
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioInputVersion, setAudioInputVersion] = useState(0);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    listContent()
      .then((items) => {
        if (!active) return;
        const item = items.find((candidate) => candidate.id === id);
        if (!item)
          throw new Error(
            'Материал не найден. Вернитесь к списку и обновите страницу.',
          );
        setCurrentItem(item);
        setForm(itemToForm(item));
        setLoadState('ready');
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'Не удалось загрузить материал.',
        );
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [id]);

  const payload = useMemo(() => payloadFor(form), [form]);
  const audioKind = form.kind === 'MEDITATION' || form.kind === 'MUSIC';
  const hasAudio =
    audioKind &&
    currentItem !== null &&
    typeof currentItem.payload.audioKey === 'string' &&
    currentItem.payload.audioKey.length > 0;
  const publishDisabled = audioKind && (!editing || !hasAudio);
  const busy = saving || uploading;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateKind(kind: ContentKind) {
    setForm((current) => ({
      ...current,
      kind,
      ...(kind === 'MEDITATION' || kind === 'MUSIC'
        ? { published: false }
        : {}),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const invalid = validationError(form, editing);
    if (invalid || !payload) {
      setError(invalid ?? 'Проверьте обязательные поля.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (id) {
        await patchContent(id, {
          access: form.access,
          titleRu: form.titleRu.trim(),
          titleKk: form.titleKk.trim(),
          summaryRu: form.summaryRu.trim(),
          summaryKk: form.summaryKk.trim(),
          ...(audioKind ? {} : { payload }),
          sortOrder: Number(form.sortOrder),
          published: form.published,
        });
        navigate('/content', {
          state: { success: 'Изменения материала сохранены.' },
        });
      } else {
        const item: NewContentItem = {
          kind: form.kind,
          access: form.access,
          slug: form.slug.trim(),
          category: form.category.trim(),
          titleRu: form.titleRu.trim(),
          titleKk: form.titleKk.trim(),
          summaryRu: form.summaryRu.trim(),
          summaryKk: form.summaryKk.trim(),
          payload,
          sortOrder: Number(form.sortOrder),
          published: form.published,
          ...(form.durationSec !== ''
            ? { durationSec: Number(form.durationSec) }
            : {}),
          ...(form.coverKey.trim() ? { coverKey: form.coverKey.trim() } : {}),
        };
        const created = await createContent({
          ...item,
          ...(audioKind ? { payload: {}, published: false } : {}),
        });
        if (audioKind) {
          navigate(`/content/${created.id}/edit`, {
            state: { success: 'Черновик создан. Теперь загрузите MP3.' },
          });
        } else {
          navigate('/content', {
            state: {
              success: form.published
                ? 'Материал создан и опубликован.'
                : 'Материал создан как черновик.',
            },
          });
        }
      }
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'Не удалось сохранить материал. Попробуйте ещё раз.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAudioUpload() {
    if (!id || !audioKind || busy) return;
    if (!audioFile) {
      setError('Выберите MP3-файл для загрузки.');
      return;
    }
    setError(null);
    setAudioMessage(null);
    setUploading(true);
    try {
      const uploaded = await uploadContentAudio(id, audioFile);
      setCurrentItem(uploaded);
      setAudioFile(null);
      setAudioInputVersion((version) => version + 1);
      setAudioMessage(
        hasAudio
          ? 'Аудио заменено.'
          : 'Аудио загружено. Теперь материал можно опубликовать.',
      );
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'Не удалось загрузить аудио. Попробуйте ещё раз.',
      );
    } finally {
      setUploading(false);
    }
  }

  if (loadState === 'loading')
    return <p className="text-sq-text-secondary">Загрузка материала…</p>;
  if (loadState === 'error')
    return (
      <div>
        <p role="alert" className="mb-4 text-sq-danger">
          {error}
        </p>
        <Link to="/content" className="text-sq-primary underline">
          Вернуться к материалам
        </Link>
      </div>
    );

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/content"
            className="text-sm text-sq-primary hover:underline"
          >
            ← Материалы
          </Link>
          <h1 className="mt-2 text-2xl font-bold">
            {editing ? 'Редактировать материал' : 'Новый материал'}
          </h1>
          <p className="mt-1 text-sm text-sq-text-secondary">
            Русская и казахская версии заполняются вместе. Черновик не виден
            клиентам.
          </p>
        </div>
      </div>

      {editing && (
        <p className="mb-5 rounded-lg bg-sq-surface-muted px-4 py-3 text-sm">
          <span className="font-semibold">
            Тип, slug, категория, длительность и обложка не меняются через
            существующий API:
          </span>{' '}
          {form.kind} · {form.slug} · {form.category}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-sq-danger"
        >
          {error}
        </div>
      )}

      <form
        aria-label="Редактор материала"
        aria-busy={busy}
        noValidate
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {!editing && (
          <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
            <h2 className="md:col-span-2 text-lg font-bold">Основа</h2>
            <label>
              <span className={labelClass}>Вид материала</span>
              <select
                aria-label="Вид материала"
                className={inputClass}
                value={form.kind}
                onChange={(e) => updateKind(e.target.value as ContentKind)}
              >
                <option value="ARTICLE">Статья</option>
                <option value="MEDITATION">Медитация</option>
                <option value="MUSIC">Музыка</option>
                <option value="BREATHING">Дыхательная практика</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Доступ</span>
              <select
                aria-label="Доступ"
                className={inputClass}
                value={form.access}
                onChange={(e) =>
                  update('access', e.target.value as ContentAccess)
                }
              >
                <option value="FREE">Бесплатно</option>
                <option value="PREMIUM">Только Premium</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Slug</span>
              <input
                aria-label="Slug"
                className={inputClass}
                value={form.slug}
                onChange={(e) => update('slug', e.target.value)}
                placeholder="anxiety-basics"
              />
              <span className={helpClass}>
                Латинские строчные буквы, цифры и дефисы; изменить после
                создания нельзя.
              </span>
            </label>
            <label>
              <span className={labelClass}>Категория</span>
              <input
                aria-label="Категория"
                className={inputClass}
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                placeholder="anxiety"
              />
              <span className={helpClass}>
                Ключ фильтра, например sleep, anxiety или focus.
              </span>
            </label>
          </section>
        )}

        <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
          <h2 className="md:col-span-2 text-lg font-bold">Тексты карточки</h2>
          <label>
            <span className={labelClass}>Заголовок на русском</span>
            <input
              aria-label="Заголовок на русском"
              className={inputClass}
              value={form.titleRu}
              onChange={(e) => update('titleRu', e.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            <span className={labelClass}>Заголовок на казахском</span>
            <input
              aria-label="Заголовок на казахском"
              className={inputClass}
              value={form.titleKk}
              onChange={(e) => update('titleKk', e.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            <span className={labelClass}>Краткое описание на русском</span>
            <textarea
              aria-label="Краткое описание на русском"
              className={`${inputClass} min-h-24`}
              value={form.summaryRu}
              onChange={(e) => update('summaryRu', e.target.value)}
              maxLength={500}
            />
          </label>
          <label>
            <span className={labelClass}>Краткое описание на казахском</span>
            <textarea
              aria-label="Краткое описание на казахском"
              className={`${inputClass} min-h-24`}
              value={form.summaryKk}
              onChange={(e) => update('summaryKk', e.target.value)}
              maxLength={500}
            />
          </label>
        </section>

        <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
          <h2 className="md:col-span-2 text-lg font-bold">Содержимое</h2>
          {form.kind === 'ARTICLE' && (
            <>
              <label>
                <span className={labelClass}>Текст статьи на русском</span>
                <textarea
                  aria-label="Текст статьи на русском"
                  className={`${inputClass} min-h-64 font-mono`}
                  value={form.markdownRu}
                  onChange={(e) => update('markdownRu', e.target.value)}
                />
                <span className={helpClass}>Поддерживается Markdown.</span>
              </label>
              <label>
                <span className={labelClass}>Текст статьи на казахском</span>
                <textarea
                  aria-label="Текст статьи на казахском"
                  className={`${inputClass} min-h-64 font-mono`}
                  value={form.markdownKk}
                  onChange={(e) => update('markdownKk', e.target.value)}
                />
                <span className={helpClass}>Поддерживается Markdown.</span>
              </label>
            </>
          )}
          {audioKind && !editing && (
            <div className="md:col-span-2 rounded-lg bg-sq-surface-muted px-4 py-3 text-sm text-sq-text-secondary">
              После создания черновика откроется загрузчик MP3. Допустим один
              файл до 25 МиБ; публикация станет доступна после успешной
              загрузки.
            </div>
          )}
          {audioKind && editing && (
            <div className="md:col-span-2 rounded-lg border border-sq-border p-4">
              <label htmlFor="content-audio">
                <span className={labelClass}>MP3-файл</span>
              </label>
              <input
                key={audioInputVersion}
                id="content-audio"
                aria-describedby="content-audio-help"
                aria-label="MP3-файл"
                type="file"
                accept="audio/mpeg,.mp3"
                className={inputClass}
                onChange={(event) =>
                  setAudioFile(event.currentTarget.files?.[0] ?? null)
                }
              />
              <p id="content-audio-help" className={helpClass}>
                Только MP3 (audio/mpeg), не более 25 МиБ. Файл хранится
                приватно; ключ в форме не показывается.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy || !audioFile}
                  onClick={handleAudioUpload}
                  className="rounded-lg bg-sq-primary-dark px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading
                    ? 'Загрузка…'
                    : hasAudio
                      ? 'Заменить аудио'
                      : 'Загрузить аудио'}
                </button>
                <span className="text-sm text-sq-text-secondary">
                  {hasAudio
                    ? 'Аудио загружено; можно заменить файл.'
                    : 'Аудио ещё не загружено.'}
                </span>
              </div>
              {audioMessage && (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-3 text-sm font-semibold text-sq-success"
                >
                  {audioMessage}
                </p>
              )}
            </div>
          )}
          {form.kind === 'BREATHING' && (
            <>
              <label className="md:col-span-2">
                <span className={labelClass}>Фазы дыхания</span>
                <textarea
                  aria-label="Фазы дыхания"
                  className={`${inputClass} min-h-32 font-mono`}
                  value={form.phases}
                  onChange={(e) => update('phases', e.target.value)}
                  placeholder={
                    'Вдох | Дем алу | 4\nЗадержка | Кідіріс | 4\nВыдох | Дем шығару | 6'
                  }
                />
                <span className={helpClass}>
                  Одна фаза на строку: название RU | атауы KK | секунды.
                </span>
              </label>
              <label>
                <span className={labelClass}>Количество циклов</span>
                <input
                  aria-label="Количество циклов"
                  type="number"
                  min="1"
                  step="1"
                  className={inputClass}
                  value={form.cycles}
                  onChange={(e) => update('cycles', e.target.value)}
                />
              </label>
            </>
          )}
        </section>

        <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
          <h2 className="md:col-span-2 text-lg font-bold">Публикация</h2>
          <label>
            <span className={labelClass}>Порядок в списке</span>
            <input
              type="number"
              min="0"
              step="1"
              className={inputClass}
              value={form.sortOrder}
              onChange={(e) => update('sortOrder', e.target.value)}
            />
          </label>
          {!editing && (
            <label>
              <span className={labelClass}>Длительность, секунд</span>
              <input
                type="number"
                min="0"
                max="86400"
                step="1"
                className={inputClass}
                value={form.durationSec}
                onChange={(e) => update('durationSec', e.target.value)}
              />
              <span className={helpClass}>
                Необязательно; для аудио и оценки времени чтения.
              </span>
            </label>
          )}
          {!editing && (
            <label className="md:col-span-2">
              <span className={labelClass}>Ключ обложки</span>
              <input
                className={inputClass}
                value={form.coverKey}
                onChange={(e) => update('coverKey', e.target.value)}
                maxLength={300}
              />
              <span className={helpClass}>
                Необязательно. Загрузчика обложек в этом интерфейсе пока нет.
              </span>
            </label>
          )}
          <label className="md:col-span-2 flex items-start gap-3 rounded-lg bg-sq-surface-muted p-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={form.published}
              disabled={publishDisabled || busy}
              onChange={(e) => update('published', e.target.checked)}
            />
            <span>
              <span className="block font-semibold">
                Опубликовать для клиентов
              </span>
              <span className={helpClass}>
                {publishDisabled
                  ? 'Сначала создайте черновик и успешно загрузите MP3.'
                  : 'Оставьте выключенным, чтобы сначала проверить черновик. Premium-доступ проверяется сервером.'}
              </span>
            </span>
          </label>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-sq-primary-dark px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Сохранение…'
              : editing
                ? 'Сохранить изменения'
                : form.published
                  ? 'Создать и опубликовать'
                  : 'Создать черновик'}
          </button>
          <Link
            to="/content"
            className="rounded-lg border px-5 py-2.5 font-semibold hover:bg-sq-surface-muted"
          >
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}
