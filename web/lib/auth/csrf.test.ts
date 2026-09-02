/**
 * Обработчики маршрутов — серверный код: им нужны Request и Response из
 * платформы, которых в jsdom нет.
 *
 * @jest-environment node
 */
import { assertSameOrigin } from './csrf';

function req(headers: Record<string, string>) {
  return new Request('http://localhost:3000/api/auth/verify-code', {
    method: 'POST',
    headers,
  });
}

describe('assertSameOrigin', () => {
  it('пропускает запрос со своего происхождения', () => {
    expect(() => assertSameOrigin(req({ origin: 'http://localhost:3000' }))).not.toThrow();
  });

  it('отвергает запрос с чужого сайта', () => {
    // Сессия в cookie — браузер приложит её и к запросу, который
    // инициировал чужой сайт. Это и есть CSRF.
    expect(() => assertSameOrigin(req({ origin: 'https://evil.example' }))).toThrow('CSRF');
  });

  it('отвергает запрос вообще без Origin', () => {
    // Для POST браузер шлёт Origin всегда; его отсутствие означает не
    // браузер, а значит запрос не заслуживает доверия к cookie.
    expect(() => assertSameOrigin(req({}))).toThrow('CSRF');
  });

  it('не обманывается похожим доменом', () => {
    expect(() => assertSameOrigin(req({ origin: 'http://localhost:3000.evil.example' }))).toThrow(
      'CSRF',
    );
  });

  it('не обманывается своим происхождением в составе чужого', () => {
    expect(() => assertSameOrigin(req({ origin: 'https://evil.example/?x=http://localhost:3000' }))).toThrow(
      'CSRF',
    );
  });
});
