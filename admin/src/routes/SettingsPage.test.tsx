import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from './SettingsPage';
import * as settings from '@/lib/settings';

vi.mock('@/lib/settings');

describe('SettingsPage', () => {
  it('показывает секрет и коды восстановления после запуска настройки 2FA', async () => {
    vi.mocked(settings.totpSetup).mockResolvedValue({
      secret: 'SECRET123',
      otpauthUrl: 'otpauth://totp/x',
      recoveryCodes: ['code-1', 'code-2'],
    });

    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Включить 2FA'));

    await waitFor(() => expect(screen.getByText('SECRET123')).toBeInTheDocument());
    expect(screen.getByText('code-1')).toBeInTheDocument();
  });

  it('подтверждение кодом вызывает totpConfirm', async () => {
    vi.mocked(settings.totpSetup).mockResolvedValue({ secret: 's', otpauthUrl: 'o', recoveryCodes: [] });
    vi.mocked(settings.totpConfirm).mockResolvedValue(undefined);

    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Включить 2FA'));
    await waitFor(() => screen.getByPlaceholderText('Код из приложения'));

    fireEvent.change(screen.getByPlaceholderText('Код из приложения'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Подтвердить'));

    await waitFor(() => expect(screen.getByText('2FA включена')).toBeInTheDocument());
    expect(settings.totpConfirm).toHaveBeenCalledWith('123456');
  });
});
