import { apiFetch } from './api';

export type ContentKind = 'MEDITATION' | 'MUSIC' | 'ARTICLE' | 'BREATHING';
export type ContentAccess = 'FREE' | 'PREMIUM';

export interface ContentItem {
  id: string;
  kind: ContentKind;
  access: ContentAccess;
  slug: string;
  category: string;
  titleRu: string;
  titleKk: string;
  summaryRu: string;
  summaryKk: string;
  /** Форма зависит от вида: markdown у статьи, фазы у дыхания, audioKey у аудио. */
  payload: Record<string, unknown>;
  durationSec?: number | null;
  sortOrder: number;
  /** null — черновик: клиенту такой материал не виден вовсе. */
  publishedAt: string | null;
}

export type NewContentItem = Omit<ContentItem, 'id' | 'sortOrder' | 'publishedAt'> &
  Partial<Pick<ContentItem, 'sortOrder'>> & { published?: boolean };

export function listContent(): Promise<ContentItem[]> {
  return apiFetch('/admin/content');
}

export function createContent(item: NewContentItem): Promise<ContentItem> {
  return apiFetch('/admin/content', { method: 'POST', body: JSON.stringify(item) });
}

export function patchContent(
  id: string,
  patch: Partial<Pick<ContentItem, 'access' | 'titleRu' | 'titleKk' | 'summaryRu' | 'summaryKk' | 'payload' | 'sortOrder'>> & {
    published?: boolean;
  },
): Promise<ContentItem> {
  return apiFetch(`/admin/content/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteContent(id: string): Promise<void> {
  return apiFetch(`/admin/content/${id}`, { method: 'DELETE' });
}
