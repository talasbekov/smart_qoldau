import {
  Controller,
  Get,
  INestApplication,
  Logger,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';
import { configureApp } from '../src/bootstrap';
import { IpThrottlerGuard } from '../src/common/throttle/throttle.guards';
import { logRejectedWebhook } from '../src/common/webhooks/rejected-webhook.log';

@Controller()
class ProbeController {
  @Get('ip')
  ip(@Req() req: Request) {
    const messages: string[] = [];
    const logger = new Logger('fixture');
    logger.warn = (message: string) => {
      messages.push(message);
    };
    logRejectedWebhook(logger, req, 'fixture', 'signature_missing');
    return { ip: req.ip, ips: req.ips, log: messages[0] };
  }

  @Get('limited')
  @UseGuards(IpThrottlerGuard)
  limited() {
    return { ok: true };
  }
}

describe('bootstrap trusted proxy boundary', () => {
  let app: INestApplication;
  const original = { ...process.env };

  async function create(trusted?: string) {
    if (trusted === undefined) delete process.env.TRUSTED_PROXY_IPS;
    else process.env.TRUSTED_PROXY_IPS = trusted;
    process.env.SWAGGER_ENABLED = 'false';
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 2 }])],
      controllers: [ProbeController],
      providers: [IpThrottlerGuard],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
  }

  async function send(xff?: string, path = 'ip', peer = '127.0.0.1') {
    if (!app.getHttpServer().listening) await app.listen(0, '::ffff:127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          localAddress: peer,
          path: `/v1/${path}`,
          headers: xff === undefined ? {} : { 'X-Forwarded-For': xff },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () =>
            resolve({ status: res.statusCode!, body: JSON.parse(data) }),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  afterEach(async () => {
    if (app) await app.close();
    process.env = { ...original };
  });

  it.each([undefined, '', '  '])(
    'defaults to no trust for %p',
    async (value) => {
      await create(value);
      expect((await send('198.51.100.8')).body.ip).toBe('::ffff:127.0.0.1');
    },
  );

  it.each([
    'true',
    'false',
    '1',
    '*',
    'loopback',
    'uniquelocal',
    '10.0.0.0/8',
    '127.0.0.1/32',
    '::1/128',
    'proxy',
    '127.0.0.1,',
    ',127.0.0.1',
    '127.0.0.1,,::1',
    '127.1',
    '999.0.0.1',
    '[::1]',
    'fe80::1%eth0',
    '127.0.0.1:3000',
    '127.0.0.1\n::1',
  ])('rejects invalid configuration %p before listening', async (value) => {
    await expect(create(value)).rejects.toThrow(/TRUSTED_PROXY_IPS/);
    expect(app.getHttpServer().listening).toBe(false);
  });

  it.each(['127.0.0.1', '::ffff:127.0.0.1', ' 127.0.0.1 , 2001:db8::1 '])(
    'recognizes exact peer %p including IPv4-mapped IPv6 sockets',
    async (value) => {
      await create(value);
      const { body } = await send('198.51.100.8');
      expect(body.ip).toBe('198.51.100.8');
      expect(body.log).toContain('ip=198.51.100.8 bytes=0');
    },
  );

  it('does not trust a different direct peer or its arbitrary XFF chain', async () => {
    await create('127.0.0.1');
    const { body } = await send('198.51.100.8, 127.0.0.1', 'ip', '127.0.0.2');
    expect(body.ip).toBe('::ffff:127.0.0.2');
    expect(body.ips).toEqual([]);
  });

  it('stops at the nearest untrusted hop, ignoring the attacker-controlled prefix', async () => {
    await create('127.0.0.1,2001:db8::1');
    expect(
      (await send('203.0.113.99, 198.51.100.8, 2001:db8::1')).body.ip,
    ).toBe('198.51.100.8');
    expect((await send('203.0.113.99, ::ffff:198.51.100.8')).body.ip).toBe(
      '::ffff:198.51.100.8',
    );
  });

  it('keeps a peer without XFF as the IP (including the BFF boundary)', async () => {
    await create('127.0.0.1');
    expect((await send(undefined)).body.ip).toBe('::ffff:127.0.0.1');
    expect((await send(undefined, 'ip', '127.0.0.2')).body.ip).toBe(
      '::ffff:127.0.0.2',
    );
  });

  it('isolates real client throttle buckets and cannot reset one by spoofing a prefix', async () => {
    await create('127.0.0.1');
    expect((await send('198.51.100.8', 'limited')).status).toBe(200);
    expect((await send('203.0.113.99, 198.51.100.8', 'limited')).status).toBe(
      200,
    );
    const blocked = await send('203.0.113.100, 198.51.100.8', 'limited');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect((await send('198.51.100.9', 'limited')).status).toBe(200);
  });

  it('cannot evade direct-peer throttling by changing XFF', async () => {
    await create('127.0.0.3');
    expect((await send('198.51.100.8', 'limited')).status).toBe(200);
    expect((await send('198.51.100.9', 'limited')).status).toBe(200);
    expect((await send('198.51.100.10', 'limited')).status).toBe(429);
  });
});
