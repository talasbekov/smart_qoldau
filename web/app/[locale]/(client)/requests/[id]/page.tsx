import { notFound } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api/public';
import { readAccessToken } from '@/lib/auth/cookies';
import RequestStatus, { type RequestState } from '@/components/client/RequestStatus';

// Первое состояние берётся на сервере: иначе экран ожидания сначала
// мигает пустотой, а человек в этот момент как раз ждёт ответа.
async function getRequest(id: string): Promise<RequestState | null> {
  const token = await readAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/requests/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as RequestState;
  } catch {
    return null;
  }
}

export default async function RequestPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const request = await getRequest(id);
  if (!request) notFound();

  return <RequestStatus requestId={id} initial={request} locale={locale} />;
}
