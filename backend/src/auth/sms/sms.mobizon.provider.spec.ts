import { ConfigService } from '@nestjs/config';
import { MobizonSmsProvider } from './sms.mobizon.provider';

// Юнит: fetch мокается глобально (Node 22+, глобальный fetch),
// реальный HTTP не ходит.
describe('MobizonSmsProvider (юнит)', () => {
  function makeProvider(apiKey = 'test-api-key') {
    const config = {
      getOrThrow: jest.fn(() => apiKey),
    } as unknown as ConfigService;
    return new MobizonSmsProvider(config);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('успешный ответ {code:0} -> resolve', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 0 }),
    }) as unknown as typeof fetch;

    const provider = makeProvider();

    await expect(
      provider.send('+77011234567', 'Ваш код: 1234'),
    ).resolves.toBeUndefined();
  });

  it('{code:1, message} -> throw с сообщением из API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 1, message: 'Неверный номер получателя' }),
    }) as unknown as typeof fetch;

    const provider = makeProvider();

    await expect(provider.send('+77011234567', 'text')).rejects.toThrow(
      'Неверный номер получателя',
    );
  });

  it('сетевой сбой -> throw', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const provider = makeProvider();

    await expect(provider.send('+77011234567', 'text')).rejects.toThrow(
      'network down',
    );
  });

  it('не-ok HTTP-статус (502) -> throw с осмысленным сообщением, apiKey не в тексте ошибки', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ code: 0 }),
    }) as unknown as typeof fetch;

    const provider = makeProvider('secret-key-123');

    await expect(provider.send('+77011234567', 'text')).rejects.toThrow(/502/);
    await expect(provider.send('+77011234567', 'text')).rejects.not.toThrow(
      /secret-key-123/,
    );
  });

  it('невалидный JSON в ответе (HTML вместо JSON) -> throw с осмысленным сообщением', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    }) as unknown as typeof fetch;

    const provider = makeProvider();

    await expect(provider.send('+77011234567', 'text')).rejects.toThrow(
      'Mobizon SMS: невалидный ответ API (не JSON)',
    );
  });

  it('apiKey и текст уходят в запрос, recipient без "+", таймаут 10с через AbortSignal', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 0 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

    const provider = makeProvider('secret-key-123');
    await provider.send('+77011234567', 'Ваш код: 1234');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mobizon.kz/service/message/sendsmsmessage');
    expect(options.method).toBe('POST');
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutSpy).toHaveBeenCalledWith(10_000);

    const bodyString =
      options.body instanceof URLSearchParams
        ? options.body.toString()
        : String(options.body);
    const params = new URLSearchParams(bodyString);
    expect(params.get('apiKey')).toBe('secret-key-123');
    expect(params.get('recipient')).toBe('77011234567');
    expect(params.get('text')).toBe('Ваш код: 1234');
  });
});
