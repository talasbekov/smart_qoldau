import {
  ExecutionContext,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from './admin-jwt.guard';
import { AdminSessionService } from './admin-session.service';

// handleRequest проверяет ТОЛЬКО форму payload'а (isAdmin), актуальность
// сотрудника сверяется отдельно в canActivate (E11a, задача 4) — здесь
// сервис не вызывается, достаточно заглушки.
const sessionStub = {} as AdminSessionService;

// context не используется дефолтной логикой handleRequest AuthGuard -
// достаточно пустой заглушки.
const context = {} as ExecutionContext;

describe('AdminJwtGuard.handleRequest', () => {
  it('payload.isAdmin === true -> возвращает payload', () => {
    const guard = new AdminJwtGuard(sessionStub);
    const payload = {
      sub: 'staff-1',
      isGuest: false,
      isAdmin: true as const,
      roles: [AdminRole.SUPPORT_OPERATOR],
    };

    expect(guard.handleRequest(null, payload, null, context)).toBe(payload);
  });

  it('пользовательский токен без isAdmin -> 403 ADMIN_FORBIDDEN', () => {
    const guard = new AdminJwtGuard(sessionStub);
    const payload = { sub: 'user-1', isGuest: false };

    expect(() => guard.handleRequest(null, payload, null, context)).toThrow(
      HttpException,
    );
    try {
      guard.handleRequest(null, payload, null, context);
      fail('ожидалось исключение');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const err = e as HttpException;
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse()).toEqual({
        code: 'ADMIN_FORBIDDEN',
        message: expect.any(String),
      });
    }
  });

  it('нет пользователя (невалидный/отсутствующий токен) -> стандартные 401 passport', () => {
    const guard = new AdminJwtGuard(sessionStub);

    expect(() => guard.handleRequest(null, false, null, context)).toThrow(
      UnauthorizedException,
    );
  });

  it('ошибка passport-стратегии -> прокидывается как есть', () => {
    const guard = new AdminJwtGuard(sessionStub);
    const originalError = new Error('boom');

    expect(() =>
      guard.handleRequest(originalError, false, null, context),
    ).toThrow(originalError);
  });
});
