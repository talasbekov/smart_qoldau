import { render, screen } from '@testing-library/react';
import RoleGate from './RoleGate';
import { tokenStore } from '@/lib/tokenStore';

describe('RoleGate', () => {
  beforeEach(() => localStorage.clear());

  it('не рендерит children без нужной роли', () => {
    tokenStore.set({ accessToken: 'a', refreshToken: 'r', admin: { id: '1', email: 'x', roles: ['SUPPORT_OPERATOR'] } });
    render(
      <RoleGate roles={['FINANCE_CONTROL']}>
        <div>Секрет</div>
      </RoleGate>,
    );
    expect(screen.queryByText('Секрет')).not.toBeInTheDocument();
  });

  it('рендерит children, если роль есть', () => {
    tokenStore.set({ accessToken: 'a', refreshToken: 'r', admin: { id: '1', email: 'x', roles: ['FINANCE_CONTROL'] } });
    render(
      <RoleGate roles={['FINANCE_CONTROL']}>
        <div>Секрет</div>
      </RoleGate>,
    );
    expect(screen.getByText('Секрет')).toBeInTheDocument();
  });

  it('SUPERADMIN видит всё', () => {
    tokenStore.set({ accessToken: 'a', refreshToken: 'r', admin: { id: '1', email: 'x', roles: ['SUPERADMIN'] } });
    render(
      <RoleGate roles={['FINANCE_CONTROL']}>
        <div>Секрет</div>
      </RoleGate>,
    );
    expect(screen.getByText('Секрет')).toBeInTheDocument();
  });
});
