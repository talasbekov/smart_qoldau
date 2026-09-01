/** @jest-environment node */
import { resolveApiBaseUrl } from './base-url';

describe('resolveApiBaseUrl', () => {
  it('берёт серверную переменную: адрес бэкенда меняется без пересборки', () => {
    expect(resolveApiBaseUrl({ API_BASE_URL: 'http://backend:3000/v1' })).toBe(
      'http://backend:3000/v1',
    );
  });

  it('поддерживает прежнюю NEXT_PUBLIC-переменную ради совместимости', () => {
    expect(resolveApiBaseUrl({ NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8080/v1' })).toBe(
      'http://localhost:8080/v1',
    );
  });

  it('серверная переменная важнее вшитой в бандл', () => {
    expect(
      resolveApiBaseUrl({
        API_BASE_URL: 'http://backend:3000/v1',
        NEXT_PUBLIC_API_BASE_URL: 'http://stale:9999/v1',
      }),
    ).toBe('http://backend:3000/v1');
  });

  it('отвергает относительный адрес: запрос идёт с сервера, а не из браузера', () => {
    // `/v1` в контейнере означал бы обращение к самому себе — на такой
    // конфигурации каталог молча оказывался бы пустым.
    expect(() => resolveApiBaseUrl({ API_BASE_URL: '/v1' })).toThrow(/абсолют/i);
  });

  it('без переменных берёт локальный бэкенд разработчика', () => {
    expect(resolveApiBaseUrl({})).toBe('http://localhost:3000/v1');
  });
});
