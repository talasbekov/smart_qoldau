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
});
