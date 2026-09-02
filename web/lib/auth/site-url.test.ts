/** @jest-environment node */
import { resolveSiteUrl } from './site-url';

describe('resolveSiteUrl', () => {
  it('берёт серверную переменную: публичный адрес меняется без пересборки', () => {
    expect(resolveSiteUrl({ SITE_URL: 'http://localhost:8080' })).toBe('http://localhost:8080');
  });

  it('серверная переменная важнее вшитой в бандл', () => {
    expect(
      resolveSiteUrl({ SITE_URL: 'https://smartqoldau.kz', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }),
    ).toBe('https://smartqoldau.kz');
  });

  it('отбрасывает завершающий слэш: Origin приходит без него', () => {
    // Иначе строгое сравнение с Origin никогда не совпадёт, и вход
    // отвечает 403 на каждом стенде, где адрес записали со слэшем.
    expect(resolveSiteUrl({ SITE_URL: 'http://localhost:8080/' })).toBe('http://localhost:8080');
  });

  it('без переменных берёт локальный адрес разработчика', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});
