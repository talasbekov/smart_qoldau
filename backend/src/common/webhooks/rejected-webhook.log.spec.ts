import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { logRejectedWebhook } from './rejected-webhook.log';

describe('След отклонённого вебхука', () => {
  let logger: Logger;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    logger = new Logger('test');
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  it('пишет канал, причину и адрес источника', () => {
    logRejectedWebhook(
      logger,
      { ip: '203.0.113.10', rawBody: Buffer.from('{"a":1}') },
      'payments',
      'signature_invalid',
    );

    const line = warn.mock.calls[0][0] as string;
    expect(line).toContain('channel=payments');
    expect(line).toContain('reason=signature_invalid');
    expect(line).toContain('ip=203.0.113.10');
  });

  it('тело не попадает в лог — только его хэш', () => {
    const body = Buffer.from('{"pan":"4111111111111111","amount":100}');

    logRejectedWebhook(
      logger,
      { ip: '203.0.113.10', rawBody: body },
      'payments',
      'signature_invalid',
    );

    const line = warn.mock.calls[0][0] as string;
    // У неподписанного запроса содержимое произвольное, у подписанного —
    // платёжные данные. Ни то ни другое в логах не нужно.
    expect(line).not.toContain('4111111111111111');
    expect(line).toContain(
      createHash('sha256').update(body).digest('hex').slice(0, 16),
    );
  });

  it('одинаковые повторы дают одинаковый хэш, разные — разный', () => {
    const first = Buffer.from('{"eventId":"e1"}');
    const second = Buffer.from('{"eventId":"e2"}');

    logRejectedWebhook(
      logger,
      { ip: '1.2.3.4', rawBody: first },
      'payouts',
      'signature_invalid',
    );
    logRejectedWebhook(
      logger,
      { ip: '1.2.3.4', rawBody: first },
      'payouts',
      'signature_invalid',
    );
    logRejectedWebhook(
      logger,
      { ip: '1.2.3.4', rawBody: second },
      'payouts',
      'signature_invalid',
    );

    const [a, b, c] = warn.mock.calls.map((call) => call[0] as string);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('пустое тело и неизвестный адрес не роняют вызов', () => {
    logRejectedWebhook(logger, {} as never, 'livekit', 'payload_unparsable');

    const line = warn.mock.calls[0][0] as string;
    expect(line).toContain('bytes=0');
    expect(line).toContain('ip=unknown');
  });
});
