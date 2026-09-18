import { validatedConsultationReturnTo } from './return-to';

describe('validatedConsultationReturnTo', () => {
  it.each(['ru', 'kz'])('allows the new-request continuation for %s', (locale) => {
    expect(validatedConsultationReturnTo(`/${locale}/requests/new`, locale)).toBe(`/${locale}/requests/new`);
  });

  it.each([
    ['/ru/profile', 'ru'],
    ['https://attacker.example/ru/requests/new', 'ru'],
    ['//attacker.example', 'ru'],
    ['/kz/requests/new', 'ru'],
    ['/ru/requests/new?role=EXPERT', 'ru'],
  ])('rejects a non-local or non-consultation return path %s', (value, locale) => {
    expect(validatedConsultationReturnTo(value, locale)).toBeNull();
  });
});
