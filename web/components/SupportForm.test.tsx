import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '../messages/ru.json';
import * as api from '@/lib/api/guest-ticket';

jest.mock('@/lib/api/guest-ticket');

// eslint-disable-next-line import/first
import SupportForm from './SupportForm';

function renderForm() {
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <SupportForm />
    </NextIntlClientProvider>,
  );
}

describe('SupportForm', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());

  it('has visible labels instead of relying on placeholders', () => {
    renderForm();

    expect(screen.getByLabelText(ru.support.nameField)).toBeInTheDocument();
    expect(screen.getByLabelText(ru.support.contactField)).toBeInTheDocument();
    expect(screen.getByLabelText(ru.support.messageField)).toBeInTheDocument();
  });

  it('успешная отправка показывает подтверждение', async () => {
    jest.spyOn(api, 'submitTicket').mockResolvedValue({ ok: true });
    renderForm();

    fireEvent.change(screen.getByPlaceholderText(ru.support.nameField), {
      target: { value: 'Иван' },
    });
    fireEvent.change(screen.getByPlaceholderText(ru.support.contactField), {
      target: { value: 'ivan@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(ru.support.messageField), {
      target: { value: 'Вопрос по оплате' },
    });
    fireEvent.click(screen.getByText(ru.support.submit));

    await waitFor(() =>
      expect(screen.getByText(ru.support.sent)).toBeInTheDocument(),
    );
    expect(api.submitTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        contactEmail: 'ivan@example.com',
        body: 'Иван: Вопрос по оплате',
      }),
    );
  });

  it('429 показывает текст про превышение лимита, форма остаётся заполненной', async () => {
    jest
      .spyOn(api, 'submitTicket')
      .mockResolvedValue({ ok: false, error: 'RATE_LIMITED' });
    renderForm();

    fireEvent.change(screen.getByPlaceholderText(ru.support.nameField), {
      target: { value: 'Иван' },
    });
    fireEvent.change(screen.getByPlaceholderText(ru.support.contactField), {
      target: { value: 'ivan@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(ru.support.messageField), {
      target: { value: 'Вопрос' },
    });
    fireEvent.click(screen.getByText(ru.support.submit));

    await waitFor(() =>
      expect(screen.getByText(ru.support.errorRateLimited)).toBeInTheDocument(),
    );
    expect(screen.getByPlaceholderText(ru.support.nameField)).toHaveValue(
      'Иван',
    );
  });

  it('при неизвестном исходе сохраняет черновик и блокирует слепой повтор', async () => {
    jest
      .spyOn(api, 'submitTicket')
      .mockResolvedValue({ ok: false, error: 'UNKNOWN' });
    renderForm();

    fireEvent.change(screen.getByLabelText(ru.support.nameField), {
      target: { value: 'Иван' },
    });
    fireEvent.change(screen.getByLabelText(ru.support.contactField), {
      target: { value: 'ivan@example.com' },
    });
    fireEvent.change(screen.getByLabelText(ru.support.messageField), {
      target: { value: 'Вопрос' },
    });
    fireEvent.click(screen.getByRole('button', { name: ru.support.submit }));

    expect(
      await screen.findByText(ru.support.errorUnknown),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: ru.support.submit }),
    ).toBeDisabled();
    expect(
      localStorage.getItem('smartqoldau:support:v1:guest:guest:pending'),
    ).toContain('Вопрос');
    expect(
      localStorage.getItem('smartqoldau:support:v1:guest:guest:draft'),
    ).toContain('Вопрос');
  });

  it('не начинает POST, если pending-маркер нельзя сохранить', async () => {
    const submit = jest.spyOn(api, 'submitTicket');
    renderForm();
    fireEvent.change(screen.getByLabelText(ru.support.nameField), {
      target: { value: 'Иван' },
    });
    fireEvent.change(screen.getByLabelText(ru.support.contactField), {
      target: { value: 'ivan@example.com' },
    });
    fireEvent.change(screen.getByLabelText(ru.support.messageField), {
      target: { value: 'Вопрос' },
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    fireEvent.click(screen.getByRole('button', { name: ru.support.submit }));

    expect(submit).not.toHaveBeenCalled();
    expect(
      await screen.findByText(ru.support.errorStorage),
    ).toBeInTheDocument();
  });
});
