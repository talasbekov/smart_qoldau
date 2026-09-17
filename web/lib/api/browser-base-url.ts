import { resolveApiBaseUrl } from './base-url';

// Next заменяет NEXT_PUBLIC_* в browser bundle только при прямом обращении
// к свойству, а не когда ему передают весь process.env. Private API_BASE_URL
// намеренно сюда не попадает: он остаётся runtime-адресом SSR и BFF.
export const BROWSER_API_BASE_URL = resolveApiBaseUrl(
  { NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL },
  'browser',
);
