import { envValidationSchema } from './env.validation';
import { parseTrustedProxyIps } from './trusted-proxy';

describe('trusted proxy environment validation', () => {
  it.each(['true', '10.0.0.0/8', '127.0.0.1,', 'fe80::1%eth0'])(
    'rejects %p during ConfigModule validation',
    (value) => {
      const result = envValidationSchema.validate(
        { TRUSTED_PROXY_IPS: value },
        { abortEarly: false },
      );
      expect(
        result.error?.details.some(
          (detail) =>
            detail.path[0] === 'TRUSTED_PROXY_IPS' &&
            detail.type === 'any.custom',
        ),
      ).toBe(true);
    },
  );

  it.each([undefined, '', ' ', '127.0.0.1', '::ffff:127.0.0.1, 2001:db8::1'])(
    'accepts %p during ConfigModule validation',
    (value) => {
      const result = envValidationSchema.validate(
        { TRUSTED_PROXY_IPS: value },
        { abortEarly: false },
      );
      expect(
        result.error?.details.some(
          (detail) => detail.path[0] === 'TRUSTED_PROXY_IPS',
        ),
      ).toBe(false);
    },
  );

  it('does not reflect invalid input in the startup error', () => {
    expect(() => parseTrustedProxyIps('sensitive-fixture\nvalue')).toThrow(
      'TRUSTED_PROXY_IPS must be a comma-separated list of exact IP addresses',
    );
    try {
      parseTrustedProxyIps('sensitive-fixture\nvalue');
    } catch (error) {
      expect(error.message).not.toContain('sensitive-fixture');
    }
  });
});
