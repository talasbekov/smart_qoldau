import { render, screen } from '@testing-library/react';
import ExpertProfile from './ExpertProfile';

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
  about: 'Работаю с выгоранием и тревогой.',
} as never;

const REVIEWS = {
  items: [
    {
      rating: 5,
      publicText: 'Помогла разобраться.',
      expertReply: null,
      tags: ['attentive'],
      createdAt: '2026-08-01T10:00:00.000Z',
    },
  ],
  distribution: { one: 0, two: 0, three: 0, four: 0, five: 1 },
  ratingAvg: 4.8,
  ratingCount: 24,
} as never;

describe('ExpertProfile', () => {
  it('имя специалиста — заголовок первого уровня', () => {
    render(<ExpertProfile expert={EXPERT} reviews={REVIEWS} locale="ru" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Айгуль Смагулова',
    );
  });

  it('показывает цену и то, за что она', () => {
    render(<ExpertProfile expert={EXPERT} reviews={REVIEWS} locale="ru" />);

    expect(screen.getByText('9 900 ₸')).toBeInTheDocument();
    expect(screen.getByText('за консультацию')).toBeInTheDocument();
  });

  it('переводит языки и форматы на человеческий', () => {
    render(<ExpertProfile expert={EXPERT} reviews={REVIEWS} locale="ru" />);

    expect(screen.getByText('Русский, Қазақша')).toBeInTheDocument();
    expect(screen.getByText('Чат, Видео')).toBeInTheDocument();
  });

  it('показывает отзывы без имени автора', () => {
    render(<ExpertProfile expert={EXPERT} reviews={REVIEWS} locale="ru" />);

    expect(screen.getByText('Помогла разобраться.')).toBeInTheDocument();
    // Анонимность клиента — инвариант продукта, а не оформление.
    expect(screen.getByText(/Анонимный клиент/)).toBeInTheDocument();
  });

  it('переживает отсутствие отзывов, а не падает', () => {
    render(<ExpertProfile expert={EXPERT} reviews={null} locale="ru" />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/пока нет отзывов/i)).toBeInTheDocument();
  });

  it('ведёт обратно в каталог', () => {
    render(<ExpertProfile expert={EXPERT} reviews={REVIEWS} locale="ru" />);

    expect(
      screen.getByRole('link', { name: /Все специалисты/ }),
    ).toHaveAttribute('href', '/ru/catalog');
  });

  it('ведёт из профиля в запись к выбранному специалисту', () => {
    render(<ExpertProfile expert={EXPERT} reviews={REVIEWS} locale="ru" />);

    expect(
      screen.getByRole('link', { name: 'Записаться на консультацию' }),
    ).toHaveAttribute('href', '/ru/consultations/book/e1');
  });

  it('локализует вход в запись на казахском маршруте', () => {
    render(<ExpertProfile expert={EXPERT} reviews={REVIEWS} locale="kz" />);

    expect(
      screen.getByRole('link', { name: 'Кеңеске жазылу' }),
    ).toHaveAttribute('href', '/kz/consultations/book/e1');
    expect(
      screen.getByRole('link', { name: /Барлық мамандар/ }),
    ).toHaveAttribute('href', '/kz/catalog');
    expect(screen.getByText('кеңес үшін')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Маман туралы' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Орысша, Қазақша')).toBeInTheDocument();
    expect(screen.getByText('Чат, Видео')).toBeInTheDocument();
  });
});
