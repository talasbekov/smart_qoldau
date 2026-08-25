import { render, screen, fireEvent } from '@testing-library/react';
import DecisionModal from './DecisionModal';

describe('DecisionModal', () => {
  it('approve без комментария разрешён', () => {
    const onSubmit = vi.fn();
    render(<DecisionModal title="Решение" requireCommentOnReject onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Одобрить'));
    expect(onSubmit).toHaveBeenCalledWith({ approve: true, comment: undefined });
  });

  it('reject без комментария при requireCommentOnReject блокирует отправку', () => {
    const onSubmit = vi.fn();
    render(<DecisionModal title="Решение" requireCommentOnReject onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Отклонить'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Комментарий обязателен при отклонении')).toBeInTheDocument();
  });

  it('reject с комментарием отправляет решение', () => {
    const onSubmit = vi.fn();
    render(<DecisionModal title="Решение" requireCommentOnReject onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Комментарий'), { target: { value: 'Плохое фото' } });
    fireEvent.click(screen.getByText('Отклонить'));
    expect(onSubmit).toHaveBeenCalledWith({ approve: false, comment: 'Плохое фото' });
  });
});
