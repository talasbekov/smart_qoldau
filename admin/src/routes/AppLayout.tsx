import { NavLink, Outlet } from 'react-router-dom';
import { tokenStore } from '@/lib/tokenStore';
import RoleGate from '@/components/RoleGate';

// Тёмная боковая панель — как в единственном прототипе внутреннего
// кабинета (`Expert Web`): продукт один, и админка не должна выглядеть
// чужой. Активный пункт подсвечен полупрозрачным белым, как там же.
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2.5 rounded-sq text-sm font-semibold ${
    isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
  }`;

export default function AppLayout({
  onLogout,
}: {
  onLogout: () => Promise<void>;
}) {
  const session = tokenStore.get();

  return (
    <div className="flex min-h-screen bg-sq-background">
      <aside className="w-[260px] shrink-0 bg-sq-primary-dark p-5 flex flex-col gap-0.5">
        <div className="mb-6">
          <div className="text-sm font-extrabold text-white leading-tight">
            SmartQoldau
          </div>
          <div className="text-[11px] font-bold tracking-wide text-[#7FD6C2]">
            ADMIN
          </div>
        </div>
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
        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="text-xs text-white/55 mb-2">
            {session?.admin.email}
          </div>
          <button
            onClick={() => void onLogout()}
            className="text-sm text-white/80 hover:text-white"
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 text-sq-text">
        <Outlet />
      </main>
    </div>
  );
}
