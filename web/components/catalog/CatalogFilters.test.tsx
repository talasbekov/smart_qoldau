import { render, screen } from '@testing-library/react';
import CatalogFilters from './CatalogFilters';

const TOPICS = [
  { id: '1', slug: 'burnout', name: 'Выгорание' },
  { id: '2', slug: 'anxiety-stress', name: 'Тревога и стресс' },
];

describe('CatalogFilters', () => {
  it('работает без скриптов: обычная форма с методом GET', () => {
    const { container } = render(<CatalogFilters topics={TOPICS} selected={{}} action="/ru/catalog" />);

    const form = container.querySelector('form');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/ru/catalog');
  });

  it('у каждого списка есть видимая подпись, а не только placeholder', () => {
    render(<CatalogFilters topics={TOPICS} selected={{}} action="/ru/catalog" />);

    for (const label of ['Специализация', 'Формат', 'Язык', 'Сортировка']) {
      expect(screen.getByLabelText(label)).toBeInstanceOf(HTMLSelectElement);
    }
  });

  it('имена полей совпадают с параметрами адреса, которые читает страница', () => {
    render(<CatalogFilters topics={TOPICS} selected={{}} action="/ru/catalog" />);

    expect(screen.getByLabelText('Специализация')).toHaveAttribute('name', 'topic');
    expect(screen.getByLabelText('Формат')).toHaveAttribute('name', 'format');
    expect(screen.getByLabelText('Язык')).toHaveAttribute('name', 'language');
    expect(screen.getByLabelText('Сортировка')).toHaveAttribute('name', 'sort');
  });

  it('показывает выбранное значение, а не сбрасывает его при перезагрузке', () => {
    render(
      <CatalogFilters topics={TOPICS} selected={{ topic: 'burnout', format: 'video' }} action="/ru/catalog" />,
    );

    expect(screen.getByLabelText('Специализация')).toHaveValue('burnout');
    expect(screen.getByLabelText('Формат')).toHaveValue('video');
  });

  it('первым пунктом каждого списка идёт «любой», иначе фильтр не снять', () => {
    render(<CatalogFilters topics={TOPICS} selected={{ topic: 'burnout' }} action="/ru/catalog" />);

    const options = screen.getByLabelText('Специализация').querySelectorAll('option');
    expect(options[0]).toHaveValue('');
    expect(options[0].textContent).toMatch(/все|люб/i);
  });

  it('темы приходят из справочника, а не зашиты в вёрстку', () => {
    render(<CatalogFilters topics={TOPICS} selected={{}} action="/ru/catalog" />);

    expect(screen.getByRole('option', { name: 'Выгорание' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Тревога и стресс' })).toBeInTheDocument();
  });

  it('страница сбрасывается при смене фильтра: иначе третья страница пуста', () => {
    const { container } = render(
      <CatalogFilters topics={TOPICS} selected={{ topic: 'burnout' }} action="/ru/catalog" />,
    );

    // Скрытого поля page нет — значит новая выборка начнётся с первой страницы.
    expect(container.querySelector('input[name="page"]')).toBeNull();
  });
});
