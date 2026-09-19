import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createSupportStorage } from '@/lib/support-storage';
import LogoutButton from './LogoutButton';

const replace = jest.fn();
const refresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

describe('LogoutButton support cleanup', () => {
  beforeEach(() => {
    localStorage.clear();
    replace.mockReset();
    refresh.mockReset();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it('clears every support owner scope but preserves unrelated storage', async () => {
    createSupportStorage('user-a').saveCreateDraft({
      revision: 'a',
      payload: { category: 'TECHNICAL', subject: 'A', body: 'private A' },
    });
    createSupportStorage('user-b').saveReplyDraft('ticket-b', {
      revision: 'b',
      payload: { body: 'private B' },
    });
    localStorage.setItem('unrelated', 'keep');

    render(<LogoutButton locale="ru" />);
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/ru'));
    expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(createSupportStorage('user-a').readCreateDraft().status).toBe(
      'missing',
    );
    expect(
      createSupportStorage('user-b').readReplyDraft('ticket-b').status,
    ).toBe('missing');
  });
  it.each(['network', 'http'])(
    'keeps the account visible and offers retry on %s failure',
    async (kind) => {
      const fetchMock = global.fetch as jest.Mock;
      if (kind === 'network')
        fetchMock.mockRejectedValueOnce(new Error('offline'));
      else fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });
      render(<LogoutButton locale="ru" />);
      fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        /Не удалось выйти/,
      );
      expect(replace).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/ru'));
    },
  );

  it('labels logout in Kazakh', () => {
    render(<LogoutButton locale="kz" />);
    expect(screen.getByRole('button', { name: 'Шығу' })).toBeInTheDocument();
  });
  it('waits for the shared session lock before clearing cookies', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: async (_name: string, work: () => unknown) => {
          await gate;
          return work();
        },
      },
    });
    render(<LogoutButton locale="ru" />);
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(global.fetch).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/ru'));
  });
});

beforeEach(() => {
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: async (_name: string, work: () => unknown) => work() },
  });
});
