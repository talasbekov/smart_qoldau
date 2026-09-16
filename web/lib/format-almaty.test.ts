import {
  formatAlmatyDateTime,
  formatAlmatyDay,
  formatAlmatyTime,
} from './format-almaty';

const SLOT = '2026-09-17T04:00:00.000Z';

describe('Asia/Almaty date formatting', () => {
  it('форматирует UTC слот как русские 09:00 четверга', () => {
    expect(formatAlmatyDay(SLOT, 'ru')).toBe('чт, 17 сентября');
    expect(formatAlmatyTime(SLOT)).toBe('09:00');
    expect(formatAlmatyDateTime(SLOT, 'ru', true)).toBe(
      '17 сентября 2026, 09:00',
    );
  });

  it('не зависит от ICU браузера для казахского календаря', () => {
    expect(formatAlmatyDay(SLOT, 'kz')).toBe('бс, 17 қыркүйек');
    expect(formatAlmatyDateTime(SLOT, 'kz')).toBe('17 қыркүйек, 09:00');
    expect(formatAlmatyDateTime(SLOT, 'kz', true)).toBe(
      '2026 жылғы 17 қыркүйек, 09:00',
    );
  });
});
