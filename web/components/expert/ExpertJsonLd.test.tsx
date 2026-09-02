import { render } from '@testing-library/react';
import ExpertJsonLd from './ExpertJsonLd';

const EXPERT = {
  id: 'e1',
  displayName: 'Айгуль Смагулова',
  city: 'Алматы',
  experience: 'THREE_TO_FIVE',
  priceTiyn: 990000,
  languages: ['ru', 'kz'],
  formats: ['chat', 'video'],
  topicSlugs: ['burnout'],
  workStatus: 'ACCEPTING',
  ratingAvg: 4.8,
  ratingCount: 24,
  photoUrl: null,
  about: 'Работаю с выгоранием.',
} as never;

function parse(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script!.textContent!);
}

describe('ExpertJsonLd', () => {
  it('описывает специалиста и цену для поисковика', () => {
    const { container } = render(<ExpertJsonLd expert={EXPERT} url="https://smartqoldau.kz/ru/experts/e1" />);
    const data = parse(container);

    expect(data['@type']).toBe('Person');
    expect(data.name).toBe('Айгуль Смагулова');
    expect(data.offers.price).toBe('9900');
    expect(data.offers.priceCurrency).toBe('KZT');
    expect(data.aggregateRating.ratingValue).toBe(4.8);
    expect(data.aggregateRating.reviewCount).toBe(24);
  });

  it('не выдаёт рейтинг, когда отзывов нет', () => {
    const { container } = render(
      <ExpertJsonLd expert={{ ...(EXPERT as object), ratingAvg: 0, ratingCount: 0 } as never} url="https://x/1" />,
    );

    // Пустой aggregateRating — повод для поисковика счесть разметку
    // недостоверной и снять её у всего сайта, а не только здесь.
    expect(parse(container).aggregateRating).toBeUndefined();
  });

  it('не отдаёт наружу того, чего нет в публичной карточке', () => {
    const { container } = render(<ExpertJsonLd expert={EXPERT} url="https://x/1" />);
    const serialized = JSON.stringify(parse(container));

    // Микроразметка видна всем и индексируется — PII-инвариант тут
    // особенно дорог: утечка в JSON-LD переживёт удаление со страницы.
    expect(serialized).not.toContain('phone');
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain('userId');
  });

  it('экранирует закрывающий тег, чтобы разметку нельзя было разорвать', () => {
    const { container } = render(
      <ExpertJsonLd expert={{ ...(EXPERT as object), displayName: 'A</script><script>x' } as never} url="https://x/1" />,
    );

    expect(container.querySelectorAll('script')).toHaveLength(1);
  });
});
