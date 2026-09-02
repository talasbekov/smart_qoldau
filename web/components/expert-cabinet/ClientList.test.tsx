import { render, screen } from '@testing-library/react';
import ClientList from './ClientList';

const client = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  displayName: 'Айгерим',
  consultations: 3,
  lastAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

describe('ClientList', () => {
  it('пусто — объясняет, почему, а не молчит', () => {
    render(<ClientList items={[]} locale="ru" />);

    // Список может быть пуст не потому, что клиентов нет, а потому, что
    // они не дали согласия. Молчание тут читается как поломка.
    expect(screen.getByText(/согласи/i)).toBeInTheDocument();
  });

  it('показывает имя и число встреч', () => {
    render(<ClientList items={[client()] as never} locale="ru" />);

    expect(screen.getByText('Айгерим')).toBeInTheDocument();
    expect(screen.getByText(/3 встреч/)).toBeInTheDocument();
  });

  it('ведёт в карточку клиента', () => {
    render(<ClientList items={[client()] as never} locale="ru" />);

    expect(screen.getByRole('link', { name: /Айгерим/ })).toHaveAttribute(
      'href',
      '/ru/expert/clients/u1',
    );
  });

  it('не показывает телефона — его и не приходит', () => {
    const { container } = render(<ClientList items={[client()] as never} locale="ru" />);

    expect(container.textContent).not.toMatch(/\+7\d/);
  });
});
