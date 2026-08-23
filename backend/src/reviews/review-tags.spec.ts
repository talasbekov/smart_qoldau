import { REVIEW_TAGS, isTagAllowed } from './review-tags';

// Словарь взят из прототипа (`docs/Прототип/SmartQoldau - Оценка.dc.html`),
// а не придуман: набор зависит от числа звёзд, и тег чужой оценки —
// ошибка клиента, а не мелочь. Свободный ввод не допускается вовсе,
// иначе это второй канал публичного текста в обход модерации.
describe('Словарь тегов отзыва', () => {
  it('в каждом наборе ровно три кода и наборы заданы для всех пяти оценок', () => {
    expect(Object.keys(REVIEW_TAGS).sort()).toEqual(['1', '2', '3', '4', '5']);
    for (const rating of [1, 2, 3, 4, 5] as const) {
      expect(REVIEW_TAGS[rating]).toHaveLength(3);
      expect(new Set(REVIEW_TAGS[rating]).size).toBe(3);
    }
  });

  it('тег из набора четвёрки не проходит для оценки 2', () => {
    expect(isTagAllowed(4, 'professional')).toBe(true);
    expect(isTagAllowed(2, 'professional')).toBe(false);
  });

  it('attentive и helped_figure_out общие для 4 и 5', () => {
    for (const tag of ['attentive', 'helped_figure_out']) {
      expect(isTagAllowed(4, tag)).toBe(true);
      expect(isTagAllowed(5, tag)).toBe(true);
    }
  });

  it('exceeded_expectations принадлежит только пятёрке', () => {
    expect(isTagAllowed(5, 'exceeded_expectations')).toBe(true);
    for (const rating of [1, 2, 3, 4]) {
      expect(isTagAllowed(rating, 'exceeded_expectations')).toBe(false);
    }
  });

  it('неизвестный код отклоняется для любой оценки', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(isTagAllowed(rating, 'awesome')).toBe(false);
      expect(isTagAllowed(rating, '')).toBe(false);
    }
  });

  it('оценка вне 1..5 не открывает ни одного тега', () => {
    expect(isTagAllowed(0, 'attentive')).toBe(false);
    expect(isTagAllowed(6, 'attentive')).toBe(false);
  });
});
