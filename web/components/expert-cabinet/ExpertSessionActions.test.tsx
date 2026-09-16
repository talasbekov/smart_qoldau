import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const apiFetch = jest.fn();
jest.mock('@/lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public code: string | null,
    ) {
      super(code ?? String(status));
    }
  },
}));

// eslint-disable-next-line import/first
import ExpertSessionActions from './ExpertSessionActions';
// eslint-disable-next-line import/first
import { ApiError } from '@/lib/api/client';

const NOTE = { text: 'Первичная заметка', updatedAt: '2026-09-16T03:00:00.000Z' };

function completeResult(paymentStatus: string) {
  return {
    id: 'c1',
    status: 'COMPLETED',
    outcome: 'COMPLETED',
    paymentStatus,
  };
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((path: string) => {
    if (path === 'consultations/c1/note') return Promise.resolve(NOTE);
    throw new Error(`unexpected ${path}`);
  });
});

afterEach(() => jest.clearAllMocks());

async function renderLoaded(over: Partial<React.ComponentProps<typeof ExpertSessionActions>> = {}) {
  render(
    <ExpertSessionActions
      consultationId="c1"
      locale="ru"
      active
      initialPaymentStatus="HELD"
      {...over}
    />,
  );
  expect(await screen.findByDisplayValue('Первичная заметка')).toBeInTheDocument();
}

describe('ExpertSessionActions', () => {
  it('ошибка загрузки заметки имеет recovery и корректный пустой state', async () => {
    apiFetch
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ text: null });
    render(
      <ExpertSessionActions
        consultationId="c1"
        locale="ru"
        active
        initialPaymentStatus="HELD"
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось загрузить/i);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));

    expect(await screen.findByLabelText('Приватная заметка')).toHaveValue('');
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('загружает приватную заметку только через expert API и объясняет приватность', async () => {
    await renderLoaded();

    expect(apiFetch).toHaveBeenCalledWith('consultations/c1/note');
    expect(screen.getByText(/видна только вам/i)).toBeInTheDocument();
  });

  it('не сообщает о сохранении заметки до подтверждения API', async () => {
    let resolveSave!: (value: unknown) => void;
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (!init) return Promise.resolve(NOTE);
      return new Promise((resolve) => {
        resolveSave = resolve;
      });
    });
    await renderLoaded();
    fireEvent.change(screen.getByLabelText('Приватная заметка'), {
      target: { value: 'Новая заметка' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить заметку' }));

    expect(screen.queryByText('Заметка сохранена')).toBeNull();
    expect(screen.getByRole('button', { name: 'Сохраняем…' })).toBeDisabled();
    resolveSave({ text: 'Новая заметка', updatedAt: '2026-09-16T04:00:00.000Z' });
    expect(await screen.findByText('Заметка сохранена')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenLastCalledWith('consultations/c1/note', {
      method: 'PUT',
      body: JSON.stringify({ text: 'Новая заметка' }),
    });
  });

  it('не затирает правки, внесённые во время сохранения предыдущей версии', async () => {
    let resolveSave!: (value: unknown) => void;
    apiFetch.mockImplementation((_path: string, init?: RequestInit) => {
      if (!init) return Promise.resolve(NOTE);
      return new Promise((resolve) => {
        resolveSave = resolve;
      });
    });
    await renderLoaded();
    fireEvent.change(screen.getByLabelText('Приватная заметка'), {
      target: { value: 'Первая версия' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить заметку' }));
    fireEvent.change(screen.getByLabelText('Приватная заметка'), {
      target: { value: 'Первая версия и новое наблюдение' },
    });

    resolveSave({ text: 'Первая версия' });

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Сохраняем…' })).toBeNull(),
    );
    expect(screen.getByLabelText('Приватная заметка')).toHaveValue(
      'Первая версия и новое наблюдение',
    );
    expect(screen.queryByText('Заметка сохранена')).toBeNull();
    expect(screen.getByRole('button', { name: 'Сохранить заметку' })).toBeEnabled();
  });

  it('при ошибке заметки сохраняет текст и даёт повторить', async () => {
    apiFetch
      .mockResolvedValueOnce(NOTE)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ text: 'Черновик', updatedAt: 'later' });
    await renderLoaded();
    fireEvent.change(screen.getByLabelText('Приватная заметка'), {
      target: { value: 'Черновик' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить заметку' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось сохранить/i);
    expect(screen.getByDisplayValue('Черновик')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Повторить сохранение' }));
    expect(await screen.findByText('Заметка сохранена')).toBeInTheDocument();
  });

  it('предлагает ровно четыре канонических outcome и требует отдельного подтверждения', async () => {
    await renderLoaded();
    const outcome = screen.getByLabelText('Исход консультации');
    expect(Array.from(outcome.querySelectorAll('option')).map((option) => option.value)).toEqual([
      'COMPLETED',
      'CLIENT_NO_SHOW',
      'CLIENT_CANCELLED',
      'TECH_ISSUE',
    ]);

    fireEvent.change(outcome, { target: { value: 'TECH_ISSUE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Завершить консультацию' }));

    expect(apiFetch).not.toHaveBeenCalledWith(
      'consultations/c1/complete',
      expect.anything(),
    );
    expect(screen.getByText(/техническая проблема/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подтвердить завершение' })).toBeInTheDocument();
  });

  it('посылает outcome один раз и блокирует повторное действие до ответа', async () => {
    let resolveComplete!: (value: unknown) => void;
    const statusSync = jest.fn();
    window.addEventListener('sq:expert-work-status-sync', statusSync);
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path.endsWith('/note')) return Promise.resolve(NOTE);
      if (path.endsWith('/complete') && init) {
        return new Promise((resolve) => {
          resolveComplete = resolve;
        });
      }
      throw new Error('unexpected');
    });
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Завершить консультацию' }));
    const confirm = screen.getByRole('button', { name: 'Подтвердить завершение' });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(screen.queryByText('Консультация завершена')).toBeNull();
    expect(screen.getByRole('button', { name: 'Завершаем…' })).toBeDisabled();
    expect(apiFetch).toHaveBeenCalledTimes(2); // GET note + one POST complete
    resolveComplete(completeResult('CAPTURED'));
    expect(await screen.findByText('Консультация завершена')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    expect(statusSync).toHaveBeenCalledTimes(1);
    window.removeEventListener('sq:expert-work-status-sync', statusSync);
  });

  it('ошибка complete не выдаётся за успех, сохраняет outcome и даёт retry', async () => {
    apiFetch
      .mockResolvedValueOnce(NOTE)
      .mockRejectedValueOnce(new ApiError(409, 'INVALID_OUTCOME'))
      .mockResolvedValueOnce(completeResult('VOIDED'));
    await renderLoaded();
    fireEvent.change(screen.getByLabelText('Исход консультации'), {
      target: { value: 'CLIENT_NO_SHOW' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Завершить консультацию' }));
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/недоступен/i);
    expect(screen.queryByText('Консультация завершена')).toBeNull();
    expect(screen.getByText(/клиент не подключился/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Повторить завершение' }));
    expect(await screen.findByText('Консультация завершена')).toBeInTheDocument();
  });

  it('COMPLETED + HELD показывает ожидающий расчёт, а не успешный capture', async () => {
    apiFetch
      .mockResolvedValueOnce(NOTE)
      .mockResolvedValueOnce(completeResult('HELD'));
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Завершить консультацию' }));
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }));

    expect(await screen.findByText('Консультация завершена')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/расчёт.*ожидает/i);
    expect(screen.getByRole('status')).toHaveTextContent(/HELD.*не CAPTURED/i);
  });

  it('после потерянного ответа сверяет сервер и показывает подтверждённый outcome', async () => {
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path.endsWith('/note')) return Promise.resolve(NOTE);
      if (path.endsWith('/complete') && init) {
        return Promise.reject(new TypeError('response lost after commit'));
      }
      if (path === 'consultations/c1' && !init) {
        return Promise.resolve(completeResult('HELD'));
      }
      throw new Error(`unexpected ${path}`);
    });
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Завершить консультацию' }));
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }));

    expect(await screen.findByText('Консультация завершена')).toBeInTheDocument();
    expect(screen.getByText(/подтверждённый исход.*консультация состоялась/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/HELD.*не CAPTURED/i);
    expect(screen.queryByText(/исход не сохранён/i)).toBeNull();
    expect(apiFetch).toHaveBeenCalledWith('consultations/c1');
  });

  it('при недоступной сверке сохраняет неопределённость и не повторяет POST вслепую', async () => {
    apiFetch
      .mockResolvedValueOnce(NOTE)
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockRejectedValueOnce(new TypeError('status unavailable'))
      .mockRejectedValueOnce(new TypeError('still unavailable'));
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Завершить консультацию' }));
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/неизвестно.*сохранён/i);
    expect(screen.queryByText(/исход не сохранён/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Повторить завершение' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Проверить статус' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(4));
    expect(
      apiFetch.mock.calls.filter(([path]) => path === 'consultations/c1/complete'),
    ).toHaveLength(1);
  });

  it('после подтверждённого ACTIVE + HELD разрешает только явный ручной повтор outcome', async () => {
    let posts = 0;
    let reads = 0;
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path.endsWith('/note')) return Promise.resolve(NOTE);
      if (path.endsWith('/complete') && init) {
        posts += 1;
        if (posts === 1) return Promise.reject(new TypeError('request not sent'));
        return Promise.resolve(completeResult('CAPTURED'));
      }
      if (path === 'consultations/c1' && !init) {
        reads += 1;
        return Promise.resolve({
          status: 'ACTIVE',
          outcome: null,
          paymentStatus: 'HELD',
        });
      }
      throw new Error(`unexpected ${path}`);
    });
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Завершить консультацию' }));
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }));

    const retry = await screen.findByRole('button', {
      name: 'Повторить завершение',
    });
    expect(posts).toBe(1);
    expect(reads).toBe(1);
    expect(screen.queryByText('Консультация завершена')).toBeNull();

    fireEvent.click(retry);

    expect(await screen.findByText('Консультация завершена')).toBeInTheDocument();
    expect(posts).toBe(2);
  });

  it('для неактивной консультации не даёт повторно отправить outcome, но оставляет заметку', async () => {
    await renderLoaded({ active: false });

    expect(screen.queryByRole('button', { name: 'Завершить консультацию' })).toBeNull();
    expect(screen.getByLabelText('Приватная заметка')).toBeInTheDocument();
    expect(screen.getByText(/уже не активна/i)).toBeInTheDocument();
  });

  it('локализует экспертский workflow на казахский', async () => {
    await renderLoaded({ locale: 'kz' });

    expect(screen.getByLabelText('Жеке жазба')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Кеңесті аяқтау' })).toBeInTheDocument();
  });
});
