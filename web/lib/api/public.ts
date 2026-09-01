import type { components } from './generated';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';

export type ExpertPublic = components['schemas']['ExpertPublicDto'];
export type Topic = components['schemas']['TopicDto'];

export type ListExpertsParams = {
  topic?: string;
  language?: string;
  format?: string;
  sort?: 'price_asc' | 'price_desc' | 'rating';
  take?: number;
  skip?: number;
};

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

// Публичные списки кэшируются на пять минут: каталог меняется медленно, а
// каждый заход из поиска иначе бьёт в бэкенд. Теги — чтобы можно было
// сбросить точечно, не дожидаясь истечения срока.
export async function listExperts(params: ListExpertsParams): Promise<ExpertPublic[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/experts${toQuery(params)}`, {
      next: { revalidate: 300, tags: ['experts'] },
    });
    if (!response.ok) return [];
    return (await response.json()) as ExpertPublic[];
  } catch {
    return [];
  }
}

export async function getExpert(id: string): Promise<ExpertPublic | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/experts/${id}`, {
      next: { revalidate: 300, tags: ['experts', `expert:${id}`] },
    });
    if (!response.ok) return null;
    return (await response.json()) as ExpertPublic;
  } catch {
    return null;
  }
}

export async function listTopics(): Promise<Topic[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/topics`, {
      next: { revalidate: 3600, tags: ['topics'] },
    });
    if (!response.ok) return [];
    return (await response.json()) as Topic[];
  } catch {
    return [];
  }
}

// Языки и форматы приходят строками и показываются человеку как строки.
// Если контракт бэкенда описан неточно (например, `isArray` без `type`),
// это перестанет компилироваться — и расхождение будет видно на сборке,
// а не на странице у пользователя.
export function formatLanguages(expert: ExpertPublic): string {
  return expert.languages.map((code) => code.toUpperCase()).join(', ');
}
