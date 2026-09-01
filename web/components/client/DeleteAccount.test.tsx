import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
}));
const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

// eslint-disable-next-line import/first
import DeleteAccount from './DeleteAccount';

afterEach(() => jest.clearAllMocks());

describe('DeleteAccount', () => {
  it('не удаляет по одному нажатию', () => {
    render(<DeleteAccount locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /Удалить аккаунт/ }));

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('объясняет последствия до подтверждения', () => {
    render(<DeleteAccount locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /Удалить аккаунт/ }));

    // ТЗ §5.1: удаление необратимо и уносит историю консультаций.
    expect(screen.getByText(/безвозвратно|нельзя восстановить/i)).toBeInTheDocument();
    expect(screen.getByText(/истори/i)).toBeInTheDocument();
  });

  it('удаляет только после явного подтверждения', async () => {
    apiFetch.mockResolvedValue(null);
    render(<DeleteAccount locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /Удалить аккаунт/ }));
    fireEvent.click(screen.getByRole('button', { name: /Да, удалить/ }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('me', { method: 'DELETE' }));
  });

  it('передумать можно', () => {
    render(<DeleteAccount locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /Удалить аккаунт/ }));
    fireEvent.click(screen.getByRole('button', { name: /Отмена/ }));

    expect(screen.queryByRole('button', { name: /Да, удалить/ })).toBeNull();
  });

  it('после удаления уводит с сайта, а не оставляет в пустом кабинете', async () => {
    apiFetch.mockResolvedValue(null);
    render(<DeleteAccount locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /Удалить аккаунт/ }));
    fireEvent.click(screen.getByRole('button', { name: /Да, удалить/ }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/ru'));
  });

  it('ошибку показывает, а не делает вид, что удалил', async () => {
    apiFetch.mockRejectedValue(new Error('нет связи'));
    render(<DeleteAccount locale="ru" />);

    fireEvent.click(screen.getByRole('button', { name: /Удалить аккаунт/ }));
    fireEvent.click(screen.getByRole('button', { name: /Да, удалить/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
