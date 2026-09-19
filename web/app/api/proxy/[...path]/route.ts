import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api/public';
import { guardOrigin } from '@/lib/auth/proxy';
import { readAccessToken } from '@/lib/auth/cookies';
import { decodeToken } from '@/lib/auth/decode-token';

// Белый список первых сегментов. Без него прокси — открытый
// ретранслятор ко ВСЕМУ API от имени вошедшего человека, включая
// /admin/*: достаточно было бы подобрать путь. Перечисляем ровно то,
// что нужно кабинету клиента.
const ALLOWED = new Set([
  'consultations',
  'requests',
  'offers',
  'reviews',
  'favorites',
  'notifications',
  'payment-methods',
  'premium',
  'me',
  'topics',
  'experts',
  'bookings',
  'tickets',
  'matching',
]);

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type Ctx = { params: Promise<{ path: string[] }> };

function resolvePath(segments: string[]): string | null {
  // `..` в сегменте увёл бы запрос за пределы разрешённого префикса —
  // проверка первого сегмента тогда ничего не значит.
  if (
    segments.some(
      (s) => s === '..' || s === '.' || s.includes('/') || s.includes('\\'),
    )
  )
    return null;
  if (segments.length === 0 || !ALLOWED.has(segments[0])) return null;

  // Next уже декодировал params. Кодируем сегменты обратно: иначе %2e%2e,
  // ? и # изменят структуру URL при следующем разборе внутри fetch.
  return segments.map((segment) => encodeURIComponent(segment)).join('/');
}

function isAllowedTicketRoute(segments: string[], method: string): boolean {
  if (segments[0] !== 'tickets') return true;
  if (method === 'GET') return segments.length === 1 || segments.length === 2;
  if (method === 'POST') {
    return (
      segments.length === 1 ||
      (segments.length === 3 && segments[2] === 'reply')
    );
  }
  return false;
}

async function handle(request: Request, ctx: Ctx): Promise<NextResponse> {
  if (MUTATING.has(request.method)) {
    const blocked = guardOrigin(request);
    if (blocked) return blocked;
  }

  const { path } = await ctx.params;
  const resolved = resolvePath(path);
  // 404, а не 403: неразрешённый путь не должен подтверждать, что такой
  // маршрут вообще существует.
  // Card PAN is never accepted by this web proxy. Demo setup is a
  // separate backend capability; ownership is checked there for deletion.
  const paymentAllowed = path[0] !== 'payment-methods' || (
    (request.method === 'GET' && (path.length === 1 || (path.length === 2 && path[1] === 'setup'))) ||
    (request.method === 'POST' && path.length === 2 && path[1] === 'demo') ||
    (request.method === 'DELETE' && path.length === 2 && /^[0-9a-f-]{36}$/i.test(path[1]))
  );
  const matchingAllowed = path[0] !== 'matching' || (request.method === 'GET' && path.length === 2 && path[1] === 'online-count');
  if (
    !resolved || !paymentAllowed || !matchingAllowed ||
    !isAllowedTicketRoute(path, request.method)
  )
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });

  const token = await readAccessToken();
  if (!token)
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  if (path[0] === 'tickets' && request.method === 'POST') {
    const expectedOwner = request.headers.get('x-support-owner');
    const currentUser = decodeToken(token);
    if (!expectedOwner || !currentUser || expectedOwner !== currentUser.id) {
      return NextResponse.json(
        { code: 'SUPPORT_SESSION_CHANGED' },
        { status: 409 },
      );
    }
  }

  const search = new URL(request.url).search;
  const multipart = request.method === 'POST' && path[0] === 'experts' && path[1] === 'me' && (
    (path.length === 4 && path[2] === 'documents' && path[3] !== 'submit') ||
    (path.length === 3 && path[2] === 'photo')
  );
  const contentType = request.headers.get('content-type') ?? '';
  let body: string | ArrayBuffer | undefined;
  if (MUTATING.has(request.method)) {
    if (multipart) {
      if (!contentType.startsWith('multipart/form-data;')) {
        return NextResponse.json({ code: 'INVALID_CONTENT_TYPE' }, { status: 415 });
      }
      // Include multipart framing; the backend independently limits the file to 10MiB.
      const maxBytes = 11 * 1024 * 1024;
      if (Number(request.headers.get('content-length')) > maxBytes) {
        return NextResponse.json({ code: 'FILE_TOO_LARGE' }, { status: 413 });
      }
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            await reader.cancel();
            return NextResponse.json({ code: 'FILE_TOO_LARGE' }, { status: 413 });
          }
          chunks.push(value);
        }
      }
      const buffer = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      body = buffer.buffer;
    } else body = await request.text();
  }

  const upstream = await fetch(`${API_BASE_URL}/${resolved}${search}`, {
    method: request.method,
    headers: {
      'Content-Type': multipart ? contentType : 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
    cache: 'no-store',
  });

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  const payload = await upstream.json().catch(() => null);
  return NextResponse.json(payload, { status: upstream.status });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
