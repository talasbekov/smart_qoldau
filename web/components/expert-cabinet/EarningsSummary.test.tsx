import { render, screen } from '@testing-library/react';

// Значение ищем рядом с подписью, а не по всей странице: одна и та же
// сумма законно встречается и в плитке, и в строке таблицы.
function tile(label: string): string {
  // Подпись плитки — <p>; тот же текст встречается и заголовком столбца
  // таблицы (<th>), поэтому выбираем по тегу.
  const heading = screen
    .getAllByText(label)
    .find((node) => node.tagName === 'P')!;
  const text =
    heading.parentElement!.querySelector('p:last-child')!.textContent!;
  // Intl разделяет разряды неразрывным пробелом (U+00A0) и узкими
  // пробелами — глазами не отличить, сравнением строк отличается.
  return text.replace(/[\u00a0\u202f\u2009]/g, ' ');
}
import EarningsSummary from './EarningsSummary';

const days = [
  { date: '2026-08-31', amountTiyn: 0, consultations: 0 },
  { date: '2026-09-01', amountTiyn: 339_150, consultations: 1 },
  { date: '2026-09-02', amountTiyn: 678_300, consultations: 2 },
];

describe('EarningsSummary', () => {
  it('показывает доход за период и число консультаций', () => {
    render(
      <EarningsSummary
        days={days}
        balanceTiyn={1_017_450}
        availableTiyn={500_000}
      />,
    );

    expect(tile('Доход за период')).toBe('10 175 ₸');
    expect(tile('Консультаций')).toBe('3');
  });

  it('показывает средний чек по дням с консультациями, а не по всем', () => {
    render(
      <EarningsSummary
        days={days}
        balanceTiyn={1_017_450}
        availableTiyn={500_000}
      />,
    );

    // 10 175 ₸ на 3 консультации ≈ 3 392 ₸, а не на 3 дня.
    expect(tile('Средний чек')).toBe('3 392 ₸');
  });

  it('называет комиссию платформы: эксперт должен понимать разницу с ценой', () => {
    render(<EarningsSummary days={days} balanceTiyn={0} availableTiyn={0} />);

    expect(tile('Комиссия платформы')).toBe('15%');
  });

  it('доход по дням — таблица, а не карточки: на широком экране так читается', () => {
    render(<EarningsSummary days={days} balanceTiyn={0} availableTiyn={0} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(days.length + 1);
  });

  it('пустой период не делит на ноль', () => {
    render(<EarningsSummary days={[]} balanceTiyn={0} availableTiyn={0} />);

    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});

it('renders Kazakh earnings labels and dates without changing the money', () => {
  render(
    <EarningsSummary
      days={days}
      balanceTiyn={1_017_450}
      availableTiyn={500_000}
      locale="kz"
    />,
  );
  expect(tile('Кезеңдегі табыс')).toBe('10 175 ₸');
  expect(
    screen.getByRole('columnheader', { name: 'Күні' }),
  ).toBeInTheDocument();
  expect(screen.getByText(/1 қыркүйек/)).toBeInTheDocument();
});
