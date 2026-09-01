import { buildTicketPayload } from './ticket';

describe('buildTicketPayload', () => {
  it('распознаёт email и не трогает телефон', () => {
    const payload = buildTicketPayload({
      name: 'Иван Иванов',
      contact: 'ivan@example.com',
      message: 'Не работает оплата',
    });
    expect(payload.contactEmail).toBe('ivan@example.com');
    expect(payload.contactPhone).toBeUndefined();
  });

  it('распознаёт телефон в формате +77XXXXXXXXX', () => {
    const payload = buildTicketPayload({
      name: 'Иван',
      contact: '+77011234567',
      message: 'Вопрос',
    });
    expect(payload.contactPhone).toBe('+77011234567');
    expect(payload.contactEmail).toBeUndefined();
  });

  it('нормализует телефон без +7 в начале', () => {
    const payload = buildTicketPayload({
      name: 'Иван',
      contact: '87011234567',
      message: 'Вопрос',
    });
    expect(payload.contactPhone).toBe('+77011234567');
  });

  it('вставляет имя в начало body, category всегда OTHER', () => {
    const payload = buildTicketPayload({
      name: 'Иван Иванов',
      contact: 'ivan@example.com',
      message: 'Текст обращения',
    });
    expect(payload.body).toBe('Иван Иванов: Текст обращения');
    expect(payload.category).toBe('OTHER');
    expect(payload.subject).toBe('Обращение с сайта SmartQoldau');
  });
});
