import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  ApiError: class extends Error {},
}));
const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

// eslint-disable-next-line import/first
import ExpertVisibilityConsent from './ExpertVisibilityConsent';

afterEach(() => jest.clearAllMocks());

describe('ExpertVisibilityConsent', () => {
  it('прямо говорит, ЧТО увидит психолог', () => {
    render(<ExpertVisibilityConsent />);

    // Слово встречается и в объяснении, и в подписи к полю — проверяем,
    // что оно есть, а не что оно одно.
    expect(screen.getAllByText(/ваше имя/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/историю встреч/i).length).toBeGreaterThan(0);
  });

  it('прямо говорит, чего психолог НЕ увидит', () => {
    render(<ExpertVisibilityConsent />);

    // Без этого человек додумает худшее — например, что видно телефон.
    expect(screen.getByText(/телефон.*не/i)).toBeInTheDocument();
  });

  it('у поля имени есть видимая подпись', () => {
    render(<ExpertVisibilityConsent />);

    expect(screen.getByLabelText('Как к вам обращаться')).toBeInTheDocument();
  });

  it('объясняет, что имя может быть любым', () => {
    render(<ExpertVisibilityConsent />);

    // Требовать паспортное имя у человека, который решается попросить
    // помощи, — верный способ его потерять.
    expect(screen.getByText(/можно.*имя или/i)).toBeInTheDocument();
  });

  it('не отправляет пустое имя', () => {
    render(<ExpertVisibilityConsent />);

    fireEvent.click(screen.getByRole('button', { name: /Продолжить/ }));

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('отправляет согласие вместе с именем', async () => {
    apiFetch.mockResolvedValue({ displayName: 'Айгерим' });
    render(<ExpertVisibilityConsent />);

    fireEvent.change(screen.getByLabelText('Как к вам обращаться'), {
      target: { value: 'Айгерим' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Продолжить/ }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        'me/expert-visibility',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('на время отправки блокирует кнопку', async () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    render(<ExpertVisibilityConsent />);

    fireEvent.change(screen.getByLabelText('Как к вам обращаться'), {
      target: { value: 'Айгерим' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Продолжить/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Сохраняем/ })).toBeDisabled(),
    );
  });

  it('ошибку показывает, а не молчит', async () => {
    apiFetch.mockRejectedValue(new Error('нет связи'));
    render(<ExpertVisibilityConsent />);

    fireEvent.change(screen.getByLabelText('Как к вам обращаться'), {
      target: { value: 'Айгерим' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Продолжить/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
