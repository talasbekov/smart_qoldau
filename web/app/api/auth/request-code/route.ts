import { NextResponse } from 'next/server';
import { callBackend, guardOrigin } from '@/lib/auth/proxy';

export async function POST(request: Request): Promise<NextResponse> {
  const blocked = guardOrigin(request);
  if (blocked) return blocked;

  const upstream = await callBackend('/auth/request-code', {
    method: 'POST',
    body: await request.text(),
  });

  // Бэкенд отвечает 204 без тела; лимит по номеру отдаёт 429 с кодом —
  // его надо донести до формы, а не подменить общей ошибкой.
  return upstream.status === 204
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json(upstream.payload, { status: upstream.status });
}
