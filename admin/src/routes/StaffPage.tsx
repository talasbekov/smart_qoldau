import { useEffect, useState } from 'react';
import { listStaff, createStaff, updateStaff, type StaffCard } from '@/lib/staff';
import type { AdminRole } from '@/lib/types';

const ALL_ROLES: AdminRole[] = [
  'VERIFICATION_OPERATOR',
  'SUPPORT_OPERATOR',
  'QUALITY_TEAM',
  'FINANCE_CONTROL',
  'SUPERADMIN',
];

export default function StaffPage() {
  const [items, setItems] = useState<StaffCard[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<AdminRole[]>([]);

  async function load() {
    const result = await listStaff({ take: 100, skip: 0 });
    setItems(result.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(staff: StaffCard) {
    await updateStaff(staff.id, { isActive: !staff.isActive });
    await load();
  }

  function toggleRole(role: AdminRole) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createStaff({ email, password, roles });
    setEmail('');
    setPassword('');
    setRoles([]);
    await load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Сотрудники</h1>

      <form onSubmit={handleCreate} className="flex flex-col gap-2 mb-6 max-w-md border rounded-xl p-4">
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <input
          placeholder="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <div className="flex flex-wrap gap-3 text-sm">
          {ALL_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-1">
              <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} aria-label={role} />
              {role}
            </label>
          ))}
        </div>
        <button type="submit" className="bg-teal-700 text-white rounded px-4 py-2 self-start">
          Создать
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-gray-500">Нет сотрудников</p>
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
                  <button onClick={() => toggleActive(s)} className="text-teal-700">
                    {s.isActive ? 'Деактивировать' : 'Активировать'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
