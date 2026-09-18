import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from './AppLayout';
import { tokenStore } from '@/lib/tokenStore';

describe('AppLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    tokenStore.set({
      accessToken: 'access',
      refreshToken: 'refresh',
      admin: { id: 'a1', email: 'admin@smartqoldau.kz', roles: ['SUPERADMIN'] },
    });
  });

  it('показывает Помощник и не фиксирует desktop-ширину на узком экране', () => {
    render(
      <MemoryRouter initialEntries={['/help']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/help" element={<p>Содержимое</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Помощник' })).toHaveAttribute('href', '/help');
    expect(screen.getByRole('complementary')).toHaveClass('w-full', 'md:w-[260px]');
    expect(screen.getByRole('main')).toHaveClass('min-w-0');
  });

  it('показывает в меню только доступные по роли рабочие разделы', () => {
    tokenStore.set({
      accessToken: 'access',
      refreshToken: 'refresh',
      admin: { id: 'e1', email: 'editor@smartqoldau.kz', roles: ['CONTENT_EDITOR'] },
    });
    render(
      <MemoryRouter initialEntries={['/help']}>
        <Routes><Route element={<AppLayout />}><Route path="/help" element={<p>Содержимое</p>} /></Route></Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Материалы' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Помощник' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Верификация' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Тикеты' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Сотрудники' })).not.toBeInTheDocument();
  });
});
