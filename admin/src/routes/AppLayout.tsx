import { NavLink, Outlet } from 'react-router-dom';
import { tokenStore } from '@/lib/tokenStore';
import RoleGate from '@/components/RoleGate';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-2 rounded ${isActive ? 'bg-teal-100 text-teal-800 font-semibold' : 'text-gray-700'}`;

export default function AppLayout() {
  const session = tokenStore.get();

  function handleLogout() {
    tokenStore.clear();
    window.location.href = '/login';
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-white p-4 flex flex-col gap-1">
        <div className="font-bold mb-4">SmartQoldau Admin</div>
        <NavLink to="/verification" className={linkClass}>
          Верификация
        </NavLink>
        <NavLink to="/profile-moderation" className={linkClass}>
          Модерация профиля
        </NavLink>
        <RoleGate roles={['QUALITY_TEAM']}>
          <NavLink to="/flagged-experts" className={linkClass}>
            Эксперты с низким рейтингом
          </NavLink>
          <NavLink to="/reviews" className={linkClass}>
            Модерация отзывов
          </NavLink>
        </RoleGate>
        <RoleGate roles={['CONTENT_EDITOR']}>
          <NavLink to="/content" className={linkClass}>
            Материалы
          </NavLink>
        </RoleGate>
        <RoleGate roles={['FINANCE_CONTROL']}>
          <NavLink to="/payouts" className={linkClass}>
            Выплаты
          </NavLink>
        </RoleGate>
        <NavLink to="/tickets" className={linkClass}>
          Тикеты
        </NavLink>
        <RoleGate roles={['SUPERADMIN']}>
          <NavLink to="/staff" className={linkClass}>
            Сотрудники
          </NavLink>
        </RoleGate>
        <NavLink to="/settings" className={linkClass}>
          Настройки
        </NavLink>
        <div className="mt-auto pt-4 border-t">
          <div className="text-xs text-gray-500 mb-2">{session?.admin.email}</div>
          <button onClick={handleLogout} className="text-sm text-red-600">
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
