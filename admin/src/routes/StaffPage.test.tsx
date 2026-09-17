import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StaffPage from './StaffPage';
import * as staffApi from '@/lib/staff';

vi.mock('@/lib/staff');

describe('StaffPage', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
