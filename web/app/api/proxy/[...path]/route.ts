import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api/public';
import { guardOrigin } from '@/lib/auth/proxy';
import { readAccessToken } from '@/lib/auth/cookies';

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
]);

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type Ctx = { params: Promise<{ path: string[] }> };

function resolvePath(segments: string[]): string | null {
  // `..` в сегменте увёл бы запрос за пределы разрешённого префикса —
  // проверка первого сегмента тогда ничего не значит.
  if (segments.some((s) => s === '..' || s === '.' || s.includes('/')))
    return null;
  if (segments.length === 0 || !ALLOWED.has(segments[0])) return null;

  return segments.join('/');
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
  // Checkout только читает сохранённые способы. Не открываем через BFF
  // POST с PAN и DELETE карты лишь потому, что у сегмента общий controller.
  const readOnlyPaymentMethods =
    resolved?.split('/')[0] === 'payment-methods' && request.method !== 'GET';
  if (!resolved || readOnlyPaymentMethods)
    return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });

  const token = await readAccessToken();
  if (!token)
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const search = new URL(request.url).search;
  const body = MUTATING.has(request.method) ? await request.text() : undefined;

  const upstream = await fetch(`${API_BASE_URL}/${resolved}${search}`, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
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
