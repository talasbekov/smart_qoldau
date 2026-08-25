import { totpSetup, totpConfirm } from './settings';
import { apiFetch } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, apiFetch: vi.fn() };
});

describe('settings', () => {
  it('totpSetup вызывает POST /admin/auth/totp/setup', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ secret: 's', otpauthUrl: 'otpauth://x', recoveryCodes: ['a'] });
    const result = await totpSetup();
    expect(apiFetch).toHaveBeenCalledWith('/admin/auth/totp/setup', { method: 'POST' });
    expect(result.secret).toBe('s');
  });

  it('totpConfirm вызывает POST /admin/auth/totp/confirm с кодом', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await totpConfirm('123456');
    expect(apiFetch).toHaveBeenCalledWith('/admin/auth/totp/confirm', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    });
  });
});
