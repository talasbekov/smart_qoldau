import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { apiError } from '../common/filters/app-exception.filter';

/**
 * ВРЕМЕННЫЙ guard до внедрения RBAC (эпик E8).
 * Сравнивает заголовок X-Admin-Token со значением env ADMIN_API_TOKEN
 * через timingSafeEqual, чтобы не допускать тайминг-атаки на сравнение строк.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['x-admin-token'];
    const expected = this.config.getOrThrow<string>('ADMIN_API_TOKEN');

    const token = typeof header === 'string' ? header : '';
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);

    const valid =
      tokenBuf.length === expectedBuf.length &&
      timingSafeEqual(tokenBuf, expectedBuf);

    if (!valid) apiError('UNAUTHORIZED', 'Неверный токен администратора', 401);
    return true;
  }
}
