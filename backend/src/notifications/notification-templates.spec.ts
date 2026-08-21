import {
  CRITICAL_TYPES,
  NOTIFICATION_TYPES,
  formatTenge,
  renderTemplate,
} from './notification-templates';

describe('Шаблоны уведомлений (юнит, §5.8)', () => {
  it('каждый тип имеет непустые title/body на ru И kz, и они различаются между локалями', () => {
    for (const type of NOTIFICATION_TYPES) {
      const ru = renderTemplate(type, 'ru', {});
      const kz = renderTemplate(type, 'kz', {});
      expect(ru.title.length).toBeGreaterThan(0);
      expect(ru.body.length).toBeGreaterThan(0);
      expect(kz.title.length).toBeGreaterThan(0);
      expect(kz.body.length).toBeGreaterThan(0);
      expect(kz.title === ru.title && kz.body === ru.body).toBe(false);
    }
  });

  it('подстановки {key} работают: earning.credited с суммой', () => {
    const ru = renderTemplate('earning.credited', 'ru', {
      amountTenge: '12 750',
    });
    expect(ru.body).toContain('12 750');

    const kz = renderTemplate('earning.credited', 'kz', {
      amountTenge: '12 750',
    });
    expect(kz.body).toContain('12 750');
  });

  it('ticket.replied (E8a, задача 9, ревью): фиксированный текст без подстановок — тема тикета в шаблон не попадает, даже если её передать в data', () => {
    const leakedSubject = 'Секретная тема обращения, которая не должна утечь';

    const ru = renderTemplate('ticket.replied', 'ru', {
      subject: leakedSubject,
      ticketId: 'ticket-1',
    });
    expect(ru.title).toBe('Ответ поддержки');
    expect(ru.body).toBe('По вашему обращению есть ответ');
    expect(ru.body).not.toContain(leakedSubject);

    const kz = renderTemplate('ticket.replied', 'kz', {
      subject: leakedSubject,
      ticketId: 'ticket-1',
    });
    expect(kz.body).not.toContain(leakedSubject);
    expect(kz.title).not.toBe(ru.title);
    expect(kz.body).not.toBe(ru.body);
  });

  it('неизвестная локаль падает в ru', () => {
    const fallback = renderTemplate('offer.incoming', 'en' as never, {});
    const ru = renderTemplate('offer.incoming', 'ru', {});
    expect(fallback).toEqual(ru);
  });

  it('критичный тип ровно один — offer.incoming', () => {
    expect([...CRITICAL_TYPES]).toEqual(['offer.incoming']);
  });

  it('formatTenge (E9, задача 6): тиын -> тенге с пробелом-разделителем разрядов', () => {
    expect(formatTenge(339150)).toBe('3 392'); // 3391.5 -> округление вверх
    expect(formatTenge(1_000_000)).toBe('10 000');
    expect(formatTenge(31_000_000)).toBe('310 000');
    expect(formatTenge(50000)).toBe('500');
    expect(formatTenge(0)).toBe('0');
  });
});
