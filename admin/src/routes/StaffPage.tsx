import { useEffect, useRef, useState } from 'react';
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

const ROLE_COPY: Record<AdminRole, { label: string; description: string }> = {
  CONTENT_EDITOR: { label: 'Редактор контента', description: 'создаёт и публикует материалы' },
  VERIFICATION_OPERATOR: { label: 'Верификация', description: 'проверяет анкеты, документы и профиль эксперта' },
  SUPPORT_OPERATOR: { label: 'Поддержка', description: 'отвечает на обращения своей команды' },
  QUALITY_TEAM: { label: 'Контроль качества', description: 'модерирует отзывы и низкий рейтинг' },
  FINANCE_CONTROL: { label: 'Финансовый контроль', description: 'проверяет выплаты и финансовые тикеты' },
  SUPERADMIN: { label: 'Суперадминистратор', description: 'полный доступ, включая управление сотрудниками' },
};

type FieldErrors = { email?: string; password?: string; roles?: string };

export default function StaffPage() {
  const [items, setItems] = useState<StaffCard[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [updatingStaffId, setUpdatingStaffId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const latestLoadRequest = useRef(0);

  function messageFor(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.status === 403) {
      return 'У вас нет доступа к управлению сотрудниками.';
    }
    return error instanceof Error && error.message ? error.message : fallback;
  }

  function createMessageFor(error: unknown) {
    if (error instanceof ApiError && error.status === 400) {
      return 'Проверьте email, пароль (10–100 символов) и выберите хотя бы одну роль.';
    }
    if (error instanceof ApiError && error.code === 'STAFF_EMAIL_EXISTS') {
      return 'Сотрудник с таким email уже существует. Найдите его в списке и при необходимости активируйте.';
    }
    return messageFor(error, 'Не удалось создать сотрудника. Попробуйте ещё раз.');
  }

  async function load(successfulMutation?: string) {
    const request = ++latestLoadRequest.current;
    setLoadState('loading');
    setLoadError(null);
    try {
      const result = await listStaff({ take: 100, skip: 0 });
      if (request !== latestLoadRequest.current) return;
      setItems(result.items);
      setLoadState('ready');
    } catch (error) {
      if (request !== latestLoadRequest.current) return;
      setLoadError(successfulMutation ? `${successfulMutation}, но не удалось обновить список.` : messageFor(error, 'Не удалось загрузить сотрудников.'));
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
    setFieldErrors((current) => ({ ...current, roles: undefined }));
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function validateCreate(): FieldErrors {
    const next: FieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Введите корректный email.';
    if (password.length < 10 || password.length > 100) next.password = 'Введите пароль длиной от 10 до 100 символов.';
    if (roles.length === 0) next.roles = 'Выберите хотя бы одну роль.';
    return next;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isCreating) return;
    const invalid = validateCreate();
    setFieldErrors(invalid);
    if (Object.keys(invalid).length > 0) return;
    setActionError(null);
    setActionSuccess(null);
    setIsCreating(true);
    try {
      await createStaff({ email: email.trim(), password, roles });
      setEmail('');
      setPassword('');
      setRoles([]);
      setActionSuccess('Сотрудник создан. Передайте email и пароль для входа безопасным способом.');
      await load('Сотрудник создан');
    } catch (error) {
      setActionError(createMessageFor(error));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold">Сотрудники</h1>
      <p className="mb-5 mt-2 max-w-3xl text-sm leading-6 text-sq-text-secondary">Это учётная запись сотрудника админки: вход выполняется по email и паролю. Клиенты и эксперты регистрируются отдельно по телефону и SMS.</p>

      {loadState === 'loading' && <p className="text-sq-text-secondary">Загрузка сотрудников…</p>}
      {loadState === 'forbidden' && <p role="alert">{loadError}</p>}
      {loadState === 'error' && <p role="alert">{loadError}</p>}

      {loadState === 'ready' && (
        <>
          {actionSuccess && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{actionSuccess}</p>}
          {actionError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-sq-danger">{actionError}</p>}
          <form noValidate onSubmit={handleCreate} className="mb-7 max-w-3xl rounded-xl border bg-white p-5">
            <h2 className="mb-1 text-lg font-bold">Новый сотрудник</h2>
            <p className="mb-5 text-sm text-sq-text-secondary">Все поля обязательны. После создания пароль в интерфейсе больше не показывается.</p>
            {Object.keys(fieldErrors).length > 0 && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-sq-danger">Исправьте отмеченные поля и отправьте форму снова.</div>}
            <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-semibold">Рабочий email</span>
            <input
              aria-label="Рабочий email"
              placeholder="operator@smartqoldau.kz"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); }}
              className="w-full rounded-lg border px-3 py-2"
              required
              disabled={isCreating}
              aria-invalid={fieldErrors.email ? 'true' : undefined}
              aria-describedby={fieldErrors.email ? 'staff-email-error' : undefined}
            />
            {fieldErrors.email && <span id="staff-email-error" className="mt-1 block text-sm text-sq-danger">{fieldErrors.email}</span>}
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">Пароль для входа</span>
            <input
              aria-label="Пароль для входа"
              placeholder="Не короче 10 символов"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={100}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
              className="w-full rounded-lg border px-3 py-2"
              required
              disabled={isCreating}
              aria-invalid={fieldErrors.password ? 'true' : undefined}
              aria-describedby="staff-password-help staff-password-error"
            />
            <span id="staff-password-help" className="mt-1 block text-xs leading-5 text-sq-text-secondary">Пароль должен содержать от 10 до 100 символов. Передайте его сотруднику безопасным каналом.</span>
            {fieldErrors.password && <span id="staff-password-error" className="mt-1 block text-sm text-sq-danger">{fieldErrors.password}</span>}
            </label>
            </div>
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">Роли</legend>
              <p className="mb-3 mt-1 text-xs text-sq-text-secondary">Выберите минимум одну. Суперадминистратор получает доступ ко всем разделам.</p>
              <div className="grid gap-2 md:grid-cols-2">
              {ALL_ROLES.map((role) => (
                <label key={role} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-sq-surface-muted">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={roles.includes(role)} onChange={() => toggleRole(role)} disabled={isCreating} />
                  <span><span className="block text-sm font-semibold">{ROLE_COPY[role].label}</span><span className="block text-xs leading-5 text-sq-text-secondary">{ROLE_COPY[role].description}</span></span>
                </label>
              ))}
              </div>
              {fieldErrors.roles && <p className="mt-2 text-sm text-sq-danger">{fieldErrors.roles}</p>}
            </fieldset>
            <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={isCreating} className="bg-sq-primary-dark text-white rounded-lg px-4 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50">
              {isCreating ? 'Создание…' : 'Создать сотрудника'}
            </button>
            <p className="text-xs text-sq-text-secondary">Сброс пароля через этот интерфейс пока не поддерживается.</p>
            </div>
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
