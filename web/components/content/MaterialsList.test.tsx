import { render, screen } from '@testing-library/react';
import MaterialsList from './MaterialsList';

import type { ContentItem } from '@/lib/api/public';

const item = (over: Record<string, unknown> = {}): ContentItem =>
  ({
  id: 'm1',
  kind: 'ARTICLE',
  access: 'FREE',
  slug: 'anxiety-basics',
  category: 'anxiety',
  title: 'Как справиться с тревогой',
  summary: 'Коротко о главном',
  durationSec: 300,
  coverUrl: null,
  locked: false,
  positionPermille: 0,
  body: undefined,
  usefulYes: 0,
    usefulNo: 0,
    ...over,
  }) as ContentItem;

describe('MaterialsList', () => {
  it('пустая выборка объясняется словами', () => {
    render(<MaterialsList items={[]} selected={{}} locale="ru" />);

    expect(screen.getByText(/материалов по этим фильтрам нет/i)).toBeInTheDocument();
  });

  it('фильтры по виду — ссылки, значит выборкой можно поделиться', () => {
    render(<MaterialsList items={[item()]} selected={{}} locale="ru" />);

    expect(screen.getByRole('link', { name: 'Статьи' })).toHaveAttribute(
      'href',
      '/ru/materials?kind=ARTICLE',
    );
  });

  it('выбранный вид помечен и снимается повторным нажатием', () => {
    render(<MaterialsList items={[item()]} selected={{ kind: 'ARTICLE' }} locale="ru" />);

    const link = screen.getByRole('link', { name: 'Статьи' });
    expect(link).toHaveAttribute('aria-current', 'true');
    expect(link).toHaveAttribute('href', '/ru/materials');
  });

  it('показывает все четыре вида одним разделом', () => {
    render(<MaterialsList items={[item()]} selected={{}} locale="ru" />);

    for (const name of ['Статьи', 'Медитации', 'Дыхание', 'Музыка']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('платный материал помечен замком, но карточка видна', () => {
    render(<MaterialsList items={[item({ locked: true })]} selected={{}} locale="ru" />);

    // Человек должен понимать, ЧТО именно за подпиской.
    expect(screen.getByText('Как справиться с тревогой')).toBeInTheDocument();
    expect(screen.getByText(/Premium/)).toBeInTheDocument();
  });

  it('длительность показывается минутами, а не секундами', () => {
    render(<MaterialsList items={[item({ durationSec: 1200 })]} selected={{}} locale="ru" />);

    expect(screen.getByText(/20 мин/)).toBeInTheDocument();
  });

  it('карточка ведёт на страницу материала', () => {
    render(<MaterialsList items={[item()]} selected={{}} locale="ru" />);

    expect(screen.getByRole('link', { name: /Как справиться с тревогой/ })).toHaveAttribute(
      'href',
      '/ru/materials/m1',
    );
  });
});
