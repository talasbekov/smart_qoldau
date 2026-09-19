import { NextResponse } from 'next/server';
import { callBackend, guardOrigin } from '@/lib/auth/proxy';

export async function POST(request: Request): Promise<NextResponse> {
  const blocked = guardOrigin(request);
  if (blocked) return blocked;
  const upstream = await callBackend('/auth/demo-request-code', {
    method: 'POST', body: await request.text(),
  });
  return NextResponse.json(upstream.payload, { status: upstream.status });
}
