import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContentPage from './ContentPage';
import * as api from '@/lib/content';

vi.mock('@/lib/content');

const ITEMS = [
  {
    id: 'c1',
    kind: 'ARTICLE' as const,
    access: 'FREE' as const,
    slug: 'anxiety-basics',
    category: 'anxiety',
    titleRu: 'Тревога',
    titleKk: 'Мазасыздық',
    summaryRu: 'Кратко',
    summaryKk: 'Қысқаша',
    payload: { markdownRu: '# Ru', markdownKk: '# Kk' },
    sortOrder: 10,
    publishedAt: null,
  },
  {
    id: 'c2',
    kind: 'MEDITATION' as const,
    access: 'PREMIUM' as const,
    slug: 'deep-sleep',
    category: 'sleep',
    titleRu: 'Глубокий сон',
    titleKk: 'Терең ұйқы',
    summaryRu: '20 минут',
    summaryKk: '20 минут',
    payload: { audioKey: 'meditations/sleep.mp3' },
    sortOrder: 20,
    publishedAt: '2026-08-26T10:00:00.000Z',
  },
];

describe('ContentPage', () => {
  // Счётчики вызовов иначе текут между тестами файла — vitest здесь без
  // автоматического clearMocks.
  beforeEach(() => vi.clearAllMocks());

  it('показывает вид, доступ и статус публикации', async () => {
    vi.mocked(api.listContent).mockResolvedValue(ITEMS);
    render(<MemoryRouter><ContentPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Тревога')).toBeInTheDocument());
    expect(screen.getByText('Глубокий сон')).toBeInTheDocument();
    // Черновик и опубликованный различимы с одного взгляда — иначе
    // редактор не поймёт, видит ли материал клиент.
    expect(screen.getByTestId('status-c1')).toHaveTextContent('Черновик');
    expect(screen.getByTestId('status-c2')).toHaveTextContent('Опубликован');
    expect(screen.getByTestId('access-c2')).toHaveTextContent('Premium');
  });

  it('публикует черновик и перечитывает список', async () => {
    vi.mocked(api.listContent).mockResolvedValue(ITEMS);
    vi.mocked(api.patchContent).mockResolvedValue({ ...ITEMS[0], publishedAt: 'now' });
    render(<MemoryRouter><ContentPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Тревога')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('publish-c1'));

    await waitFor(() =>
      expect(api.patchContent).toHaveBeenCalledWith('c1', { published: true }),
    );
    expect(api.listContent).toHaveBeenCalledTimes(2);
  });

  it('удаление спрашивает подтверждение', async () => {
    vi.mocked(api.listContent).mockResolvedValue(ITEMS);
    vi.mocked(api.deleteContent).mockResolvedValue(undefined);
    render(<MemoryRouter><ContentPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Тревога')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('delete-c1'));
    // Удаление уносит прогресс и голоса людей — без подтверждения нельзя.
    expect(api.deleteContent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-delete'));
    await waitFor(() => expect(api.deleteContent).toHaveBeenCalledWith('c1'));
  });

  it('ошибка загрузки объясняется, а не оставляет пустой экран', async () => {
    vi.mocked(api.listContent).mockRejectedValue(new Error('boom'));
    render(<MemoryRouter><ContentPage /></MemoryRouter>);
    await waitFor(() =>
      expect(screen.getByTestId('content-error')).toBeInTheDocument(),
    );
  });

  it('даёт явные действия создания и редактирования', async () => {
    vi.mocked(api.listContent).mockResolvedValue(ITEMS);
    render(<MemoryRouter><ContentPage /></MemoryRouter>);
    await screen.findByText('Тревога');

    expect(screen.getByRole('link', { name: 'Создать материал' })).toHaveAttribute('href', '/content/new');
    expect(screen.getByRole('link', { name: 'Редактировать Тревога' })).toHaveAttribute('href', '/content/c1/edit');
  });
});
