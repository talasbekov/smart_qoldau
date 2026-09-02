import { render, screen } from '@testing-library/react';
import CatalogList from './CatalogList';

const EXPERT = {
  id: 'e1',
  displayName: 'Айгуль С.',
  city: 'Алматы',
  experience: 'THREE_TO_FIVE',
  priceTiyn: 399000,
  languages: ['ru'],
  formats: ['chat'],
  topicSlugs: ['burnout'],
  workStatus: 'ACCEPTING',
  ratingAvg: 4.8,
  ratingCount: 12,
  photoUrl: null,
} as never;

const QUERY = { topic: 'burnout' };

describe('CatalogList', () => {
  it('говорит прямым текстом, когда по фильтрам никого нет', () => {
    render(<CatalogList experts={[]} page={1} pageSize={12} query={{}} locale="ru" />);

    expect(screen.getByText('По заданным фильтрам специалисты не найдены')).toBeInTheDocument();
  });

  it('на первой странице не показывает ссылку «назад»', () => {
    render(<CatalogList experts={[EXPERT]} page={1} pageSize={12} query={QUERY} locale="ru" />);

    expect(screen.queryByRole('link', { name: /назад/i })).toBeNull();
  });

  it('ссылка «дальше» сохраняет выбранные фильтры', () => {
    const full = Array.from({ length: 12 }, (_, i) => ({
      ...(EXPERT as object),
      id: `e${i}`,
    })) as never[];
    render(<CatalogList experts={full} page={1} pageSize={12} query={QUERY} locale="ru" />);

    expect(screen.getByRole('link', { name: /дальше/i })).toHaveAttribute(
      'href',
      '/ru/catalog?topic=burnout&page=2',
    );
  });

  it('не зовёт на следующую страницу, когда список неполный: там пусто', () => {
    render(<CatalogList experts={[EXPERT]} page={1} pageSize={12} query={QUERY} locale="ru" />);

    expect(screen.queryByRole('link', { name: /дальше/i })).toBeNull();
  });

  it('карточка ведёт на профиль специалиста', () => {
    render(<CatalogList experts={[EXPERT]} page={1} pageSize={12} query={{}} locale="ru" />);

    expect(screen.getByRole('link', { name: /Айгуль С\./ })).toHaveAttribute('href', '/ru/experts/e1');
  });
});
