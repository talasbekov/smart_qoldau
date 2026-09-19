// Decode only the expiry for renewal timing; Nest verifies JWT signatures and
// authorization. This helper also runs in Edge middleware (no Node Buffer).
export function accessExpiresAt(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}

export const RENEW_BEFORE_MS = 30_000;
