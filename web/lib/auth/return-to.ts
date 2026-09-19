// Explicit same-origin destinations supported after a fresh login.
export function validatedConsultationReturnTo(value: string | undefined, locale: string): string | null {
  const allowed = ['requests/new', 'expert-onboarding', 'payment-methods', 'support/requests'];
  if (value && new RegExp(`^/${locale}/support/requests/[0-9a-f-]{36}$`, 'i').test(value)) return value;
  return allowed.some(path => value === `/${locale}/${path}`) ? value! : null;
}
