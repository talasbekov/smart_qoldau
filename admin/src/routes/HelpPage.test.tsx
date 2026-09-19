import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HelpPage from './HelpPage';
import { tokenStore } from '@/lib/tokenStore';

describe('HelpPage', () => {
  beforeEach(() => localStorage.clear());

  it('объясняет разницу между сотрудником и пользователями приложения', async () => {
    await tokenStore.set({
      accessToken: 'access',
      refreshToken: 'refresh',
      admin: {
        id: 'a1',
        email: 'support@smartqoldau.kz',
        roles: ['SUPPORT_OPERATOR'],
      },
    });
    render(
      <MemoryRouter>
        <HelpPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Помощник' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Сотрудник админки входит по email и паролю/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Клиент и эксперт входят по номеру телефона и коду из SMS/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Создания клиентов и экспертов вручную в админке нет/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Открыть тикеты' }),
    ).toHaveAttribute('href', '/tickets');
    expect(
      screen.queryByRole('link', { name: 'Открыть сотрудников' }),
    ).not.toBeInTheDocument();
  });

  it('для суперадмина показывает ссылки на материалы, сотрудников и настройки', async () => {
    await tokenStore.set({
      accessToken: 'access',
      refreshToken: 'refresh',
      admin: { id: 'a1', email: 'admin@smartqoldau.kz', roles: ['SUPERADMIN'] },
    });
    render(
      <MemoryRouter>
        <HelpPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('link', { name: 'Создать материал' }),
    ).toHaveAttribute('href', '/content/new');
    expect(screen.getByRole('link', { name: 'Проверить KK' })).toHaveAttribute(
      'href',
      '/kz/materials',
    );
    expect(
      screen.getByRole('link', { name: 'Открыть сотрудников' }),
    ).toHaveAttribute('href', '/staff');
    expect(
      screen.getByRole('link', { name: 'Открыть настройки' }),
    ).toHaveAttribute('href', '/settings');
    expect(
      screen.getByText(/Кнопки сброса пароля сотрудника здесь пока нет/),
    ).toBeInTheDocument();
    expect(screen.getByText(/MP3.*25 МиБ/i)).toBeInTheDocument();
    expect(screen.getByText(/Загрузчика обложек.*нет/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Для аудио и обложки загрузчика сейчас нет/i),
    ).not.toBeInTheDocument();
  });
});
