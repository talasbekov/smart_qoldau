import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

const AUDIO_DRAFT = {
  ...ARTICLE,
  id: 'a1',
  kind: 'MEDITATION' as const,
  slug: 'calm-audio',
  category: 'calm',
  titleRu: 'Спокойствие',
  titleKk: 'Тыныштық',
  payload: {},
};

const AUDIO_UPLOADED = {
  ...AUDIO_DRAFT,
  payload: { audioKey: 'content/a1/generated.mp3' },
};

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Текущий маршрут">{location.pathname}</output>;
}

function renderEditor(path = '/content/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
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

    fireEvent.change(screen.getByLabelText('Вид материала'), {
      target: { value: 'ARTICLE' },
    });
    fireEvent.change(screen.getByLabelText('Slug'), {
      target: { value: 'anxiety-basics' },
    });
    fireEvent.change(screen.getByLabelText('Категория'), {
      target: { value: 'anxiety' },
    });
    fireEvent.change(screen.getByLabelText('Заголовок на русском'), {
      target: { value: 'Тревога' },
    });
    fireEvent.change(screen.getByLabelText('Заголовок на казахском'), {
      target: { value: 'Мазасыздық' },
    });
    fireEvent.change(screen.getByLabelText('Краткое описание на русском'), {
      target: { value: 'Кратко' },
    });
    fireEvent.change(screen.getByLabelText('Краткое описание на казахском'), {
      target: { value: 'Қысқаша' },
    });
    fireEvent.change(screen.getByLabelText('Текст статьи на русском'), {
      target: { value: '# Ru' },
    });
    fireEvent.change(screen.getByLabelText('Текст статьи на казахском'), {
      target: { value: '# Kk' },
    });
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

    fireEvent.change(screen.getByLabelText('Вид материала'), {
      target: { value: 'BREATHING' },
    });
    fireEvent.change(screen.getByLabelText('Slug'), {
      target: { value: 'box-breathing' },
    });
    fireEvent.change(screen.getByLabelText('Категория'), {
      target: { value: 'anxiety' },
    });
    fireEvent.change(screen.getByLabelText('Заголовок на русском'), {
      target: { value: 'Дыхание' },
    });
    fireEvent.change(screen.getByLabelText('Заголовок на казахском'), {
      target: { value: 'Тыныс алу' },
    });
    fireEvent.change(screen.getByLabelText('Фазы дыхания'), {
      target: { value: 'Вдох | Дем алу | 4' },
    });
    fireEvent.change(screen.getByLabelText('Количество циклов'), {
      target: { value: '4' },
    });
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
    vi.mocked(api.patchContent).mockResolvedValue({
      ...ARTICLE,
      titleRu: 'Новый заголовок',
    });
    renderEditor('/content/c1/edit');

    expect(await screen.findByDisplayValue('Тревога')).toBeInTheDocument();
    expect(
      screen.getByText(/ARTICLE · anxiety-basics · anxiety/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Заголовок на русском'), {
      target: { value: 'Новый заголовок' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Сохранить изменения' }),
    );

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

  it('создаёт аудио только черновиком с пустым payload и переходит к загрузке', async () => {
    vi.mocked(api.createContent).mockResolvedValue(AUDIO_DRAFT);
    vi.mocked(api.listContent).mockResolvedValue([AUDIO_DRAFT]);
    renderEditor();

    fireEvent.change(screen.getByLabelText('Вид материала'), {
      target: { value: 'MUSIC' },
    });
    expect(screen.queryByLabelText('Ключ аудиофайла')).not.toBeInTheDocument();
    expect(screen.getByText(/После создания черновика/)).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Опубликовать для клиентов/ }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Slug'), {
      target: { value: 'calm-music' },
    });
    fireEvent.change(screen.getByLabelText('Категория'), {
      target: { value: 'calm' },
    });
    fireEvent.change(screen.getByLabelText('Заголовок на русском'), {
      target: { value: 'Музыка' },
    });
    fireEvent.change(screen.getByLabelText('Заголовок на казахском'), {
      target: { value: 'Музыка' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Создать черновик' }));

    await waitFor(() =>
      expect(api.createContent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'MUSIC',
          payload: {},
          published: false,
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Текущий маршрут')).toHaveTextContent(
        '/content/a1/edit',
      ),
    );
  });

  it('загружает MP3, сохраняет несохранённые тексты и после успеха разрешает публикацию', async () => {
    vi.mocked(api.listContent).mockResolvedValue([AUDIO_DRAFT]);
    vi.mocked(api.uploadContentAudio).mockResolvedValue(AUDIO_UPLOADED);
    renderEditor('/content/a1/edit');

    expect(await screen.findByDisplayValue('Спокойствие')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ключ аудиофайла')).not.toBeInTheDocument();
    const publish = screen.getByRole('checkbox', {
      name: /Опубликовать для клиентов/,
    });
    expect(publish).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Заголовок на русском'), {
      target: { value: 'Несохранённый заголовок' },
    });
    const file = new File(['mp3'], 'calm.mp3', { type: 'audio/mpeg' });
    fireEvent.change(screen.getByLabelText('MP3-файл'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить аудио' }));

    await waitFor(() =>
      expect(api.uploadContentAudio).toHaveBeenCalledWith('a1', file),
    );
    expect(
      await screen.findByText(
        'Аудио загружено. Теперь материал можно опубликовать.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('Несохранённый заголовок'),
    ).toBeInTheDocument();
    expect(publish).toBeEnabled();
  });

  it('заменяет существующее аудио через тот же endpoint и не отправляет payload обычным PATCH', async () => {
    vi.mocked(api.listContent).mockResolvedValue([AUDIO_UPLOADED]);
    vi.mocked(api.uploadContentAudio).mockResolvedValue({
      ...AUDIO_UPLOADED,
      payload: { audioKey: 'content/a1/replaced.mp3' },
    });
    vi.mocked(api.patchContent).mockResolvedValue(AUDIO_UPLOADED);
    renderEditor('/content/a1/edit');

    expect(
      await screen.findByRole('button', { name: 'Заменить аудио' }),
    ).toBeInTheDocument();
    const file = new File(['replacement'], 'replacement.mp3', {
      type: 'audio/mpeg',
    });
    fireEvent.change(screen.getByLabelText('MP3-файл'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Заменить аудио' }));
    await waitFor(() =>
      expect(api.uploadContentAudio).toHaveBeenCalledWith('a1', file),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Сохранить изменения' }),
    );
    await waitFor(() => expect(api.patchContent).toHaveBeenCalled());
    expect(api.patchContent).toHaveBeenCalledWith(
      'a1',
      expect.not.objectContaining({ payload: expect.anything() }),
    );
  });

  it('показывает ошибку загрузки, сохраняет выбранный файл и оставляет форму доступной для повтора', async () => {
    vi.mocked(api.listContent).mockResolvedValue([AUDIO_DRAFT]);
    vi.mocked(api.uploadContentAudio).mockRejectedValue(
      new Error('Хранилище недоступно'),
    );
    renderEditor('/content/a1/edit');

    expect(await screen.findByDisplayValue('Спокойствие')).toBeInTheDocument();
    const file = new File(['mp3'], 'calm.mp3', { type: 'audio/mpeg' });
    fireEvent.change(screen.getByLabelText('MP3-файл'), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByLabelText('Краткое описание на русском'), {
      target: { value: 'Несохранённое описание' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить аудио' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Хранилище недоступно',
    );
    expect(
      screen.getByDisplayValue('Несохранённое описание'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('MP3-файл')).toHaveProperty('files.0', file);
    expect(
      screen.getByRole('button', { name: 'Загрузить аудио' }),
    ).toBeEnabled();
  });

  it('не допускает одновременное сохранение и загрузку', async () => {
    vi.mocked(api.listContent).mockResolvedValue([AUDIO_DRAFT]);
    let finishUpload!: (item: typeof AUDIO_UPLOADED) => void;
    vi.mocked(api.uploadContentAudio).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishUpload = resolve;
        }),
    );
    renderEditor('/content/a1/edit');

    expect(await screen.findByDisplayValue('Спокойствие')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('MP3-файл'), {
      target: {
        files: [new File(['mp3'], 'calm.mp3', { type: 'audio/mpeg' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить аудио' }));

    expect(
      await screen.findByRole('button', { name: 'Загрузка…' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Сохранить изменения' }),
    ).toBeDisabled();
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true');
    finishUpload(AUDIO_UPLOADED);
    await screen.findByText(
      'Аудио загружено. Теперь материал можно опубликовать.',
    );
  });
});
