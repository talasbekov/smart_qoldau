import { NextResponse } from 'next/server';
import { callBackend } from '@/lib/auth/proxy';

// This endpoint has no cookies or credentials. It only exposes the backend's
// already fail-closed public demo switch and synthetic test phone list.
export async function GET(): Promise<NextResponse> {
  const upstream = await callBackend('/auth/demo-config', { method: 'GET' });
  return NextResponse.json(upstream.payload, {
    status: upstream.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
