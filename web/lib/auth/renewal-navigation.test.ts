import { renewalTarget, shouldRenew } from './renewal-navigation';
const jwt = (exp: number) => `x.${btoa(JSON.stringify({ exp }))}.x`;
it('accepts only local locale paths and rejects auth loops and external destinations', () => {
  expect(renewalTarget('/ru/consultations/c1?tab=chat', 'ru')).toBe('/ru/consultations/c1?tab=chat');
  for (const value of ['https://evil.test', '//evil.test', '/ru/renew-session', '/ru/login', '/api/auth/logout', '/ru/../api/auth/logout', '/ru/%2e%2e/api', '/ru/\\evil.test']) {
    expect(renewalTarget(value, 'ru')).toBe('/ru/profile');
  }
});
it('renews missing or expired access only when a refresh cookie exists', () => {
  expect(shouldRenew(undefined, 'refresh')).toBe(true);
  expect(shouldRenew(jwt(1), 'refresh')).toBe(true);
  expect(shouldRenew(jwt(Math.floor(Date.now() / 1000) + 500), 'refresh')).toBe(false);
  expect(shouldRenew(undefined, undefined)).toBe(false);
});
