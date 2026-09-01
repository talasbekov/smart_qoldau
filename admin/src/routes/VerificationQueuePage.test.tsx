import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VerificationQueuePage from './VerificationQueuePage';
import * as verificationApi from '@/lib/verification';

vi.mock('@/lib/verification');

describe('VerificationQueuePage', () => {
  it('показывает очередь и решает по анкете эксперта', async () => {
    vi.mocked(verificationApi.getQueue).mockResolvedValue([
      {
        id: 'exp1',
        displayName: 'Иван И.',
        verificationStatus: 'PENDING',
        submittedAt: new Date().toISOString(),
        documents: [],
      },
    ]);
    vi.mocked(verificationApi.decideExpert).mockResolvedValue({});

    render(<VerificationQueuePage />);
    await waitFor(() => expect(screen.getByText('Иван И.')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Решение по анкете'));
    fireEvent.click(screen.getByText('Одобрить'));

    await waitFor(() =>
      expect(verificationApi.decideExpert).toHaveBeenCalledWith('exp1', { approve: true, comment: undefined }),
    );
  });

  it('подсвечивает просроченные по SLA 24ч и не трогает свежие (ТЗ §11.4)', async () => {
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    vi.mocked(verificationApi.getQueue).mockResolvedValue([
      {
        id: 'late',
        displayName: 'Просроченный П.',
        verificationStatus: 'PENDING',
        submittedAt: hoursAgo(30),
        documents: [],
      },
      {
        id: 'fresh',
        displayName: 'Свежий С.',
        verificationStatus: 'PENDING',
        submittedAt: hoursAgo(2),
        documents: [],
      },
    ]);

    render(<VerificationQueuePage />);
    await waitFor(() => expect(screen.getByText('Просроченный П.')).toBeInTheDocument());

    expect(screen.getByText(/1 д 6 ч · просрочено/)).toBeInTheDocument();
    expect(screen.getByText('2 ч')).toBeInTheDocument();
    expect(screen.queryByText(/2 ч · просрочено/)).not.toBeInTheDocument();
  });

  it('запись без отметки об отправке показывает прочерк, а не «0 мин»', async () => {
    vi.mocked(verificationApi.getQueue).mockResolvedValue([
      {
        id: 'old',
        displayName: 'Без отметки Б.',
        verificationStatus: 'PENDING',
        submittedAt: null,
        documents: [],
      },
    ]);

    render(<VerificationQueuePage />);
    await waitFor(() => expect(screen.getByText('Без отметки Б.')).toBeInTheDocument());

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/просрочено/)).not.toBeInTheDocument();
  });
});
