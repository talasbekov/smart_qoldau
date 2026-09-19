/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';
jest.mock('next-intl/middleware', () => ({ __esModule: true, default: () => () => NextResponse.next() }));
import middleware from './middleware';
const expired = `x.${Buffer.from(JSON.stringify({ sub: 'u1', exp: 1 })).toString('base64url')}.x`;
it.each(['/ru', '/ru/catalog', '/ru/materials', '/ru/premium', '/ru/support', '/kz/about'])('keeps public %s accessible despite stale session cookies', (path) => {
  const response = middleware(new NextRequest(`http://localhost:3000${path}`, { headers: { cookie: `sq_at=${expired}; sq_rt=refresh` } }));
  expect(response.headers.get('location')).toBeNull();
});
it('renews a protected SSR destination and preserves its local query', () => {
  const response = middleware(new NextRequest('http://localhost:3000/kz/consultations/c1?tab=chat', { headers: { cookie: `sq_at=${expired}; sq_rt=refresh` } }));
  const location = new URL(response.headers.get('location')!);
  expect(location.pathname).toBe('/kz/renew-session');
  expect(location.searchParams.get('returnTo')).toBe('/kz/consultations/c1?tab=chat');
});
it('does not loop the renewal page', () => {
  const response = middleware(new NextRequest('http://localhost:3000/ru/renew-session', { headers: { cookie: 'sq_rt=refresh' } }));
  expect(response.headers.get('location')).toBeNull();
});
