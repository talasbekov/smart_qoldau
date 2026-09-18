import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StaffPage from './StaffPage';
import * as staffApi from '@/lib/staff';
import { ApiError } from '@/lib/api';

vi.mock('@/lib/staff');

describe('StaffPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('показывает загрузку, а при 403 — запрет доступа без формы', async () => {
    let rejectLoad: (reason: unknown) => void = () => undefined;
    vi.mocked(staffApi.listStaff).mockReturnValue(
      new Promise((_, reject) => {
        rejectLoad = reject;
      }),
    );

    render(<StaffPage />);

    expect(screen.getByText('Загрузка сотрудников…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать' })).not.toBeInTheDocument();

    rejectLoad(new ApiError('ADMIN_FORBIDDEN', 'Forbidden', 403));

    expect(await screen.findByText('У вас нет доступа к управлению сотрудниками.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать' })).not.toBeInTheDocument();
  });

  it('показывает ошибку загрузки без формы', async () => {
    vi.mocked(staffApi.listStaff).mockRejectedValue(new ApiError('LIST_FAILED', 'Не удалось получить список', 500));

    render(<StaffPage />);

    expect(await screen.findByText('Не удалось получить список')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать' })).not.toBeInTheDocument();
  });

  it('показывает список сотрудников', async () => {
    vi.mocked(staffApi.listStaff).mockResolvedValue({
      items: [{ id: '1', email: 'a@b.kz', roles: ['SUPPORT_OPERATOR'], isActive: true, lastLoginAt: null, createdAt: '2026-01-01' }],
      total: 1,
    });

    render(<StaffPage />);

    await waitFor(() => expect(screen.getByText('a@b.kz')).toBeInTheDocument());
  });

  it('деактивация сотрудника вызывает updateStaff', async () => {
    vi.mocked(staffApi.listStaff).mockResolvedValue({
      items: [{ id: '1', email: 'a@b.kz', roles: ['SUPPORT_OPERATOR'], isActive: true, lastLoginAt: null, createdAt: '2026-01-01' }],
      total: 1,
    });
    vi.mocked(staffApi.updateStaff).mockResolvedValue({
      id: '1',
      email: 'a@b.kz',
      roles: ['SUPPORT_OPERATOR'],
      isActive: false,
      lastLoginAt: null,
      createdAt: '2026-01-01',
    });

    render(<StaffPage />);
    await waitFor(() => screen.getByText('a@b.kz'));
    fireEvent.click(screen.getByText('Деактивировать'));

    await waitFor(() => expect(staffApi.updateStaff).toHaveBeenCalledWith('1', { isActive: false }));
  });

  it('создание сотрудника вызывает createStaff', async () => {
    vi.mocked(staffApi.listStaff).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(staffApi.createStaff).mockResolvedValue({
      id: '2',
      email: 'new@b.kz',
      roles: ['SUPPORT_OPERATOR'],
      isActive: true,
      lastLoginAt: null,
      createdAt: '2026-01-01',
    });

    render(<StaffPage />);
    await waitFor(() => screen.getByText('Нет сотрудников'));

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@b.kz' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: '0123456789' } });
    fireEvent.click(screen.getByLabelText('SUPPORT_OPERATOR'));
    fireEvent.click(screen.getByText('Создать'));

    await waitFor(() =>
      expect(staffApi.createStaff).toHaveBeenCalledWith({
        email: 'new@b.kz',
        password: '0123456789',
        roles: ['SUPPORT_OPERATOR'],
      }),
    );
  });

  it('позволяет создать сотрудника с ролью CONTENT_EDITOR', async () => {
    vi.mocked(staffApi.listStaff).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(staffApi.createStaff).mockResolvedValue({
      id: '3',
      email: 'editor@b.kz',
      roles: ['CONTENT_EDITOR'],
      isActive: true,
      lastLoginAt: null,
      createdAt: '2026-01-01',
    });

    render(<StaffPage />);
    await waitFor(() => screen.getByText('Нет сотрудников'));

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'editor@b.kz' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: '0123456789' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'CONTENT_EDITOR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() =>
      expect(staffApi.createStaff).toHaveBeenCalledWith({
        email: 'editor@b.kz',
        password: '0123456789',
        roles: ['CONTENT_EDITOR'],
      }),
    );
  });

  it('позволяет создать сотрудника с ролью SUPERADMIN', async () => {
    vi.mocked(staffApi.listStaff).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(staffApi.createStaff).mockResolvedValue({
      id: '4',
      email: 'admin@b.kz',
      roles: ['SUPERADMIN'],
      isActive: true,
      lastLoginAt: null,
      createdAt: '2026-01-01',
    });

    render(<StaffPage />);
    await screen.findByText('Нет сотрудников');

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'admin@b.kz' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: '0123456789' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'SUPERADMIN' }));
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() =>
      expect(staffApi.createStaff).toHaveBeenCalledWith({
        email: 'admin@b.kz',
        password: '0123456789',
        roles: ['SUPERADMIN'],
      }),
    );
  });

  it('не отправляет создание повторно во время pending и показывает ошибку', async () => {
    vi.mocked(staffApi.listStaff).mockResolvedValue({ items: [], total: 0 });
    let rejectCreate: (reason: unknown) => void = () => undefined;
    vi.mocked(staffApi.createStaff).mockReturnValue(
      new Promise((_, reject) => {
        rejectCreate = reject;
      }),
    );

    render(<StaffPage />);
    await screen.findByText('Нет сотрудников');
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@b.kz' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: '0123456789' } });

    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    expect(screen.getByRole('button', { name: 'Создание…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Создание…' }));
    expect(staffApi.createStaff).toHaveBeenCalledTimes(1);

    rejectCreate(new ApiError('INVALID_STAFF', 'Данные некорректны', 400));

    expect(await screen.findByText('Данные некорректны')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Создать' })).toBeEnabled();
  });

  it('показывает ошибку при неудачном изменении статуса', async () => {
    vi.mocked(staffApi.listStaff).mockResolvedValue({
      items: [{ id: '1', email: 'a@b.kz', roles: ['SUPPORT_OPERATOR'], isActive: true, lastLoginAt: null, createdAt: '2026-01-01' }],
      total: 1,
    });
    vi.mocked(staffApi.updateStaff).mockRejectedValue(new ApiError('UPDATE_FAILED', 'Не удалось обновить сотрудника', 500));

    render(<StaffPage />);
    await screen.findByText('a@b.kz');
    fireEvent.click(screen.getByRole('button', { name: 'Деактивировать' }));

    expect(await screen.findByText('Не удалось обновить сотрудника')).toBeInTheDocument();
  });
});
