import type { components } from './generated';
import { resolveApiBaseUrl } from './base-url';

export const API_BASE_URL = resolveApiBaseUrl(process.env);

export type ExpertPublic = components['schemas']['ExpertPublicDto'];
export type Topic = components['schemas']['TopicDto'];
export type ExpertReviews = components['schemas']['ExpertReviewsDto'];
export type ReviewItem = components['schemas']['ReviewItemDto'];
export type PremiumPlans = components['schemas']['PremiumPlansDto'];

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

export async function getExpertReviews(id: string, take = 5): Promise<ExpertReviews | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/experts/${id}/reviews?take=${take}`, {
      next: { revalidate: 300, tags: ['experts', `expert:${id}`] },
    });
    if (!response.ok) return null;
    return (await response.json()) as ExpertReviews;
  } catch {
    return null;
  }
}

// Цены живут на бэкенде и приходят по API. Держать их в файлах перевода
// (как было) — значит менять цену правкой перевода и получать разные
// суммы в разных локалях.
export async function getPremiumPlans(): Promise<PremiumPlans | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/premium/plans`, {
      next: { revalidate: 3600, tags: ['premium-plans'] },
    });
    if (!response.ok) return null;
    return (await response.json()) as PremiumPlans;
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
