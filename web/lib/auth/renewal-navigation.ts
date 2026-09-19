import { accessExpiresAt, RENEW_BEFORE_MS } from './token-expiry';

const RETURN_ROOTS = new Set(['profile', 'requests', 'consultations', 'expert', 'favorites', 'notifications', 'payment-methods', 'premium', 'support', 'catalog', 'materials', 'about', 'become-expert', 'expert-onboarding', 'terms', 'privacy']);

export function renewalTarget(value: string | undefined, locale: string): string {
  const fallback = `/${locale}/profile`;
  if (!value?.startsWith(`/${locale}/`) || /[\\\r\n]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://local.invalid');
    const decoded = decodeURIComponent(value.split('?')[0]);
    if (decoded.includes('\\') || decoded.split('/').some((part) => part === '.' || part === '..')) return fallback;
    if (url.origin !== 'https://local.invalid' || !url.pathname.startsWith(`/${locale}/`) || !RETURN_ROOTS.has(url.pathname.split('/')[2])) return fallback;
    return `${url.pathname}${url.search}`;
  } catch { return fallback; }
}

export function shouldRenew(access: string | undefined, refresh: string | undefined): boolean {
  if (!refresh) return false;
  const expiresAt = accessExpiresAt(access);
  return !expiresAt || expiresAt <= Date.now() + RENEW_BEFORE_MS;
}
