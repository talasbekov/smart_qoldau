// Словарь тегов отзыва (E2a). Взят из прототипа
// `docs/Прототип/SmartQoldau - Оценка.dc.html`, а не придуман: набор зависит
// от числа звёзд, порядок внутри набора — как на экране.
//
// Хранятся коды, а не подписи: казахская локаль иначе получит русский текст,
// а переименование сломает историю. Свободный ввод тегов не принимается —
// это был бы второй канал публичного текста в обход модерации.
export const REVIEW_TAGS = {
  1: ['not_helpful', 'long_wait', 'bad_connection'],
  2: ['little_use', 'did_not_understand', 'technical_issues'],
  3: ['average', 'could_be_better', 'standard'],
  4: ['attentive', 'helped_figure_out', 'professional'],
  5: ['attentive', 'helped_figure_out', 'exceeded_expectations'],
} as const satisfies Record<1 | 2 | 3 | 4 | 5, readonly string[]>;

export type ReviewRating = keyof typeof REVIEW_TAGS;

/// Принадлежит ли код набору выставленной оценки. Оценка вне 1..5 не
/// открывает ничего: проверка не должна зависеть от того, провалидировали
/// ли rating раньше.
export function isTagAllowed(rating: number, tag: string): boolean {
  const set = REVIEW_TAGS[rating as ReviewRating] as
    readonly string[] | undefined;
  return set?.includes(tag) ?? false;
}
