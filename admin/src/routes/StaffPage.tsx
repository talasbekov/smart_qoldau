import { useEffect, useState } from 'react';
import { listStaff, createStaff, updateStaff, type StaffCard } from '@/lib/staff';
import { ApiError } from '@/lib/api';
import type { AdminRole } from '@/lib/types';

const ALL_ROLES: AdminRole[] = [
  'CONTENT_EDITOR',
  'VERIFICATION_OPERATOR',
  'SUPPORT_OPERATOR',
  'QUALITY_TEAM',
  'FINANCE_CONTROL',
  'SUPERADMIN',
];

export default function StaffPage() {
  const [items, setItems] = useState<StaffCard[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingStaffId, setUpdatingStaffId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<AdminRole[]>([]);

  function messageFor(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.status === 403) {
      return 'У вас нет доступа к управлению сотрудниками.';
    }
    return error instanceof Error && error.message ? error.message : fallback;
  }

  async function load() {
    setLoadState('loading');
    setLoadError(null);
    try {
      const result = await listStaff({ take: 100, skip: 0 });
      setItems(result.items);
      setLoadState('ready');
    } catch (error) {
      setLoadError(messageFor(error, 'Не удалось загрузить сотрудников.'));
      setLoadState(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(staff: StaffCard) {
    if (updatingStaffId) return;
    setActionError(null);
    setUpdatingStaffId(staff.id);
    try {
      await updateStaff(staff.id, { isActive: !staff.isActive });
      await load();
    } catch (error) {
      setActionError(messageFor(error, 'Не удалось обновить сотрудника.'));
    } finally {
      setUpdatingStaffId(null);
    }
  }

  function toggleRole(role: AdminRole) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isCreating) return;
    setActionError(null);
    setIsCreating(true);
    try {
      await createStaff({ email, password, roles });
      setEmail('');
      setPassword('');
      setRoles([]);
      await load();
    } catch (error) {
      setActionError(messageFor(error, 'Не удалось создать сотрудника.'));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Сотрудники</h1>

      {loadState === 'loading' && <p className="text-sq-text-secondary">Загрузка сотрудников…</p>}
      {loadState === 'forbidden' && <p role="alert">{loadError}</p>}
      {loadState === 'error' && <p role="alert">{loadError}</p>}

      {loadState === 'ready' && (
        <>
          {actionError && <p role="alert" className="mb-4">{actionError}</p>}
          <form onSubmit={handleCreate} className="flex flex-col gap-2 mb-6 max-w-md border rounded-xl p-4">
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded px-3 py-2"
              required
              disabled={isCreating}
            />
            <input
              placeholder="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded px-3 py-2"
              required
              disabled={isCreating}
            />
            <div className="flex flex-wrap gap-3 text-sm">
              {ALL_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-1">
                  <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} aria-label={role} disabled={isCreating} />
                  {role}
                </label>
              ))}
            </div>
            <button type="submit" disabled={isCreating} className="bg-sq-primary-dark text-white rounded px-4 py-2 self-start">
              {isCreating ? 'Создание…' : 'Создать'}
            </button>
          </form>

          {items.length === 0 ? (
            <p className="text-sq-text-secondary">Нет сотрудников</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Email</th>
                  <th>Роли</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2">{s.email}</td>
                    <td>{s.roles.join(', ')}</td>
                    <td>{s.isActive ? 'активен' : 'деактивирован'}</td>
                    <td>
                      <button onClick={() => toggleActive(s)} disabled={updatingStaffId !== null} className="text-sq-primary">
                        {updatingStaffId === s.id ? 'Сохранение…' : s.isActive ? 'Деактивировать' : 'Активировать'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
