import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ContentEditorPage from './ContentEditorPage';
import * as api from '@/lib/content';

vi.mock('@/lib/content');

const ARTICLE = {
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
  durationSec: null,
  sortOrder: 10,
  publishedAt: null,
};

function renderEditor(path = '/content/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/content/new" element={<ContentEditorPage />} />
        <Route path="/content/:id/edit" element={<ContentEditorPage />} />
        <Route path="/content" element={<p>Список материалов</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ContentEditorPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('создаёт статью как черновик через подписанные поля, без ручного JSON', async () => {
    vi.mocked(api.createContent).mockResolvedValue(ARTICLE);
    renderEditor();

    fireEvent.change(screen.getByLabelText('Вид материала'), { target: { value: 'ARTICLE' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'anxiety-basics' } });
    fireEvent.change(screen.getByLabelText('Категория'), { target: { value: 'anxiety' } });
    fireEvent.change(screen.getByLabelText('Заголовок на русском'), { target: { value: 'Тревога' } });
    fireEvent.change(screen.getByLabelText('Заголовок на казахском'), { target: { value: 'Мазасыздық' } });
    fireEvent.change(screen.getByLabelText('Краткое описание на русском'), { target: { value: 'Кратко' } });
    fireEvent.change(screen.getByLabelText('Краткое описание на казахском'), { target: { value: 'Қысқаша' } });
    fireEvent.change(screen.getByLabelText('Текст статьи на русском'), { target: { value: '# Ru' } });
    fireEvent.change(screen.getByLabelText('Текст статьи на казахском'), { target: { value: '# Kk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));

    await waitFor(() =>
      expect(api.createContent).toHaveBeenCalledWith({
        kind: 'ARTICLE',
        access: 'FREE',
        slug: 'anxiety-basics',
        category: 'anxiety',
        titleRu: 'Тревога',
        titleKk: 'Мазасыздық',
        summaryRu: 'Кратко',
        summaryKk: 'Қысқаша',
        payload: { markdownRu: '# Ru', markdownKk: '# Kk' },
        sortOrder: 0,
        published: false,
      }),
    );
    expect(await screen.findByText('Список материалов')).toBeInTheDocument();
  });

  it('собирает дыхательные фазы из понятных строк, а не просит JSON', async () => {
    vi.mocked(api.createContent).mockResolvedValue({
      ...ARTICLE,
      id: 'b1',
      kind: 'BREATHING',
      slug: 'box-breathing',
      payload: {
        phases: [{ nameRu: 'Вдох', nameKk: 'Дем алу', seconds: 4 }],
        cycles: 4,
      },
    });
    renderEditor();

    fireEvent.change(screen.getByLabelText('Вид материала'), { target: { value: 'BREATHING' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'box-breathing' } });
    fireEvent.change(screen.getByLabelText('Категория'), { target: { value: 'anxiety' } });
    fireEvent.change(screen.getByLabelText('Заголовок на русском'), { target: { value: 'Дыхание' } });
    fireEvent.change(screen.getByLabelText('Заголовок на казахском'), { target: { value: 'Тыныс алу' } });
    fireEvent.change(screen.getByLabelText('Фазы дыхания'), { target: { value: 'Вдох | Дем алу | 4' } });
    fireEvent.change(screen.getByLabelText('Количество циклов'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));

    await waitFor(() =>
      expect(api.createContent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'BREATHING',
          payload: {
            phases: [{ nameRu: 'Вдох', nameKk: 'Дем алу', seconds: 4 }],
            cycles: 4,
          },
        }),
      ),
    );
  });

  it('редактирует только поля, которые принимает PATCH API', async () => {
    vi.mocked(api.listContent).mockResolvedValue([ARTICLE]);
    vi.mocked(api.patchContent).mockResolvedValue({ ...ARTICLE, titleRu: 'Новый заголовок' });
    renderEditor('/content/c1/edit');

    expect(await screen.findByDisplayValue('Тревога')).toBeInTheDocument();
    expect(screen.getByText(/ARTICLE · anxiety-basics · anxiety/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Заголовок на русском'), { target: { value: 'Новый заголовок' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));

    await waitFor(() =>
      expect(api.patchContent).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          titleRu: 'Новый заголовок',
          payload: { markdownRu: '# Ru', markdownKk: '# Kk' },
          published: false,
        }),
      ),
    );
  });

  it('объясняет отсутствие загрузчика для аудио и показывает серверную ошибку', async () => {
    vi.mocked(api.createContent).mockRejectedValue(new Error('Материал с таким slug уже есть'));
    renderEditor();

    fireEvent.change(screen.getByLabelText('Вид материала'), { target: { value: 'MUSIC' } });
    expect(screen.getByText(/Загрузки файлов в админке пока нет/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'calm-music' } });
    fireEvent.change(screen.getByLabelText('Категория'), { target: { value: 'calm' } });
    fireEvent.change(screen.getByLabelText('Заголовок на русском'), { target: { value: 'Музыка' } });
    fireEvent.change(screen.getByLabelText('Заголовок на казахском'), { target: { value: 'Музыка' } });
    fireEvent.change(screen.getByLabelText('Ключ аудиофайла'), { target: { value: 'music/calm.mp3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Материал с таким slug уже есть');
  });
});
