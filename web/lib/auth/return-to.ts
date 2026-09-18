// После входа продолжаем только тот короткий путь, который инициирует
// консультацию. Это не универсальный `next`: так URL нельзя превратить в
// редирект на чужой сайт или в обход обычной ролевой навигации.
export function validatedConsultationReturnTo(value: string | undefined, locale: string): string | null {
  const allowed = `/${locale}/requests/new`;
  return value === allowed ? allowed : null;
}
