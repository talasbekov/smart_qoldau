/// Теги отзыва: закрытый словарь, зависящий от выставленной оценки.
///
/// Коды повторяют `backend/src/reviews/review-tags.ts` 1:1 и взяты из
/// прототипа `docs/Прототип/SmartQoldau - Оценка.dc.html`. Подписи здесь
/// намеренно отсутствуют: они живут в локализации приложения, иначе
/// казахская локаль получила бы русский текст.
library;

const Map<int, List<String>> reviewTags = {
  1: ['not_helpful', 'long_wait', 'bad_connection'],
  2: ['little_use', 'did_not_understand', 'technical_issues'],
  3: ['average', 'could_be_better', 'standard'],
  4: ['attentive', 'helped_figure_out', 'professional'],
  5: ['attentive', 'helped_figure_out', 'exceeded_expectations'],
};

/// Максимум тегов в одном отзыве — столько же принимает бэкенд.
const int maxReviewTags = 3;

/// Набор для оценки; для оценки вне 1..5 — пусто.
List<String> reviewTagsFor(int rating) => reviewTags[rating] ?? const [];
