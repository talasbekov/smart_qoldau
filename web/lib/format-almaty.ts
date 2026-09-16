const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;

const MONTHS = {
  ru: [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ],
  kz: [
    'қаңтар',
    'ақпан',
    'наурыз',
    'сәуір',
    'мамыр',
    'маусым',
    'шілде',
    'тамыз',
    'қыркүйек',
    'қазан',
    'қараша',
    'желтоқсан',
  ],
} as const;

const WEEKDAYS = {
  ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  kz: ['жс', 'дс', 'сс', 'ср', 'бс', 'жм', 'сб'],
} as const;

function language(locale: string): 'ru' | 'kz' {
  return locale === 'kz' ? 'kz' : 'ru';
}

function parts(iso: string) {
  const local = new Date(new Date(iso).getTime() + ALMATY_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

export function almatyDateKey(iso: string): string {
  const value = parts(iso);
  return `${value.year}-${String(value.month + 1).padStart(2, '0')}-${String(
    value.day,
  ).padStart(2, '0')}`;
}

export function formatAlmatyTime(iso: string): string {
  const value = parts(iso);
  return `${String(value.hour).padStart(2, '0')}:${String(
    value.minute,
  ).padStart(2, '0')}`;
}

export function formatAlmatyDay(iso: string, locale: string): string {
  const lang = language(locale);
  const value = parts(iso);
  return `${WEEKDAYS[lang][value.weekday]}, ${value.day} ${MONTHS[lang][value.month]}`;
}

export function formatAlmatyDateTime(
  iso: string,
  locale: string,
  includeYear = false,
): string {
  const lang = language(locale);
  const value = parts(iso);
  const date = `${value.day} ${MONTHS[lang][value.month]}`;
  const withYear = includeYear
    ? lang === 'kz'
      ? `${value.year} жылғы ${date}`
      : `${date} ${value.year}`
    : date;
  return `${withYear}, ${formatAlmatyTime(iso)}`;
}
