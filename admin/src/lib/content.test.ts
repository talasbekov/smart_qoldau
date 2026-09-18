import {
  listContent,
  createContent,
  patchContent,
  deleteContent,
  uploadContentAudio,
} from './content';
import { apiFetch } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const ARTICLE = {
  kind: 'ARTICLE' as const,
  access: 'FREE' as const,
  slug: 'anxiety-basics',
  category: 'anxiety',
  titleRu: 'Тревога',
  titleKk: 'Мазасыздық',
  summaryRu: 'Кратко',
  summaryKk: 'Қысқаша',
  payload: { markdownRu: '# Ru', markdownKk: '# Kk' },
};

describe('content API', () => {
  it('listContent -> GET /admin/content', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    await listContent();
    expect(apiFetch).toHaveBeenCalledWith('/admin/content');
  });

  it('createContent -> POST /admin/content с телом материала', async () => {
    vi.mocked(apiFetch).mockResolvedValue({});
    await createContent(ARTICLE);
    expect(apiFetch).toHaveBeenCalledWith('/admin/content', {
      method: 'POST',
      body: JSON.stringify(ARTICLE),
    });
  });

  it('patchContent публикует и снимает с публикации', async () => {
    vi.mocked(apiFetch).mockResolvedValue({});
    await patchContent('c1', { published: true });
    expect(apiFetch).toHaveBeenCalledWith('/admin/content/c1', {
      method: 'PATCH',
      body: JSON.stringify({ published: true }),
    });
  });

  it('deleteContent -> DELETE /admin/content/:id', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await deleteContent('c1');
    expect(apiFetch).toHaveBeenCalledWith('/admin/content/c1', {
      method: 'DELETE',
    });
  });

  it('uploadContentAudio передаёт тот же File в multipart-поле file', async () => {
    vi.mocked(apiFetch).mockResolvedValue({});
    const file = new File(['mp3'], 'calm.mp3', { type: 'audio/mpeg' });

    await uploadContentAudio('c1', file);

    const [, init] = vi.mocked(apiFetch).mock.lastCall ?? [];
    expect(apiFetch).toHaveBeenCalledWith('/admin/content/c1/audio', {
      method: 'POST',
      body: expect.any(FormData),
    });
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get('file')).toBe(file);
  });
});
