import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ru from '../messages/ru.json';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

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
  it('успешная отправка показывает подтверждение', async () => {
    jest.spyOn(api, 'submitTicket').mockResolvedValue({ ok: true });
    renderForm();

    fireEvent.change(screen.getByPlaceholderText(ru.support.nameField), { target: { value: 'Иван' } });
    fireEvent.change(screen.getByPlaceholderText(ru.support.contactField), {
      target: { value: 'ivan@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(ru.support.messageField), {
      target: { value: 'Вопрос по оплате' },
    });
    fireEvent.click(screen.getByText(ru.support.submit));

    await waitFor(() => expect(screen.getByText(ru.support.sent)).toBeInTheDocument());
    expect(api.submitTicket).toHaveBeenCalledWith(
      expect.objectContaining({ contactEmail: 'ivan@example.com', body: 'Иван: Вопрос по оплате' }),
    );
  });

  it('429 показывает текст про превышение лимита, форма остаётся заполненной', async () => {
    jest.spyOn(api, 'submitTicket').mockResolvedValue({ ok: false, error: 'RATE_LIMITED' });
    renderForm();

    fireEvent.change(screen.getByPlaceholderText(ru.support.nameField), { target: { value: 'Иван' } });
    fireEvent.change(screen.getByPlaceholderText(ru.support.contactField), {
      target: { value: 'ivan@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(ru.support.messageField), { target: { value: 'Вопрос' } });
    fireEvent.click(screen.getByText(ru.support.submit));

    await waitFor(() => expect(screen.getByText(ru.support.errorRateLimited)).toBeInTheDocument());
    expect(screen.getByPlaceholderText(ru.support.nameField)).toHaveValue('Иван');
  });
});
