import { listStaff, createStaff, updateStaff } from './staff';
import { apiFetch } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, apiFetch: vi.fn() };
});

describe('staff API', () => {
  it('listStaff запрашивает GET /admin/staff с пагинацией', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [], total: 0 });
    await listStaff({ take: 20, skip: 0 });
    expect(apiFetch).toHaveBeenCalledWith('/admin/staff?take=20&skip=0');
  });

  it('createStaff отправляет POST /admin/staff', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: '1', email: 'a', roles: [], isActive: true });
    await createStaff({ email: 'a@b.kz', password: '0123456789', roles: ['SUPPORT_OPERATOR'] });
    expect(apiFetch).toHaveBeenCalledWith('/admin/staff', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.kz', password: '0123456789', roles: ['SUPPORT_OPERATOR'] }),
    });
  });

  it('updateStaff отправляет PATCH /admin/staff/:id', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: '1', email: 'a', roles: [], isActive: false });
    await updateStaff('1', { isActive: false });
    expect(apiFetch).toHaveBeenCalledWith('/admin/staff/1', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
  });
});
