// Слаг локали в адресе и код языка для браузера — разные вещи.
// В адресах используется `kz`, потому что так привычнее читателю из
// Казахстана, но `kz` — это код СТРАНЫ. Языку казахский по BCP 47
// соответствует `kk`, и именно его ждут скринридеры, переводчики и
// поисковики в атрибуте lang.
const BY_LOCALE: Record<string, string> = { ru: 'ru', kz: 'kk' };

export function htmlLang(locale: string): string {
  return BY_LOCALE[locale] ?? locale;
}
