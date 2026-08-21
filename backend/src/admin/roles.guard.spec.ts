import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt.strategy';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

// Класс-пример с реально применённым декоратором @Roles — метаданные читаются
// настоящим Reflector'ом, а не мокаются напрямую.
class DummyController {
  @Roles(AdminRole.SUPPORT_OPERATOR)
  withRoles() {}

  withoutRoles() {}
}

// Класс-пример с @Roles НА КЛАССЕ (естественный жест рядом с классовым
// @UseGuards) — регрессионный кейс финального ревью E8a (п.3): раньше guard
// читал метаданные только с context.getHandler() и молча пропускал такой
// маршрут любому сотруднику.
@Roles(AdminRole.FINANCE_CONTROL)
class DummyControllerWithClassRoles {
  noOwnRoles() {}

  @Roles(AdminRole.SUPPORT_OPERATOR)
  overridesClassRoles() {}
}

function buildContext(
  handler: (...args: unknown[]) => unknown,
  user?: Partial<JwtPayload>,
  cls: new (...args: unknown[]) => unknown = DummyController,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function buildGuard(): RolesGuard {
  return new RolesGuard(new Reflector());
}

describe('RolesGuard.canActivate', () => {
  it('у сотрудника есть требуемая роль -> пропускает', () => {
    const guard = buildGuard();
    const context = buildContext(DummyController.prototype.withRoles, {
      sub: 'staff-1',
      isGuest: false,
      isAdmin: true,
      roles: [AdminRole.SUPPORT_OPERATOR],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('у сотрудника нет требуемой роли -> 403 ADMIN_FORBIDDEN', () => {
    const guard = buildGuard();
    const context = buildContext(DummyController.prototype.withRoles, {
      sub: 'staff-2',
      isGuest: false,
      isAdmin: true,
      roles: [AdminRole.FINANCE_CONTROL],
    });

    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
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

  it('SUPERADMIN без требуемой роли -> пропускает', () => {
    const guard = buildGuard();
    const context = buildContext(DummyController.prototype.withRoles, {
      sub: 'staff-3',
      isGuest: false,
      isAdmin: true,
      roles: [AdminRole.SUPERADMIN],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('маршрут без метаданных @Roles -> пропускает', () => {
    const guard = buildGuard();
    const context = buildContext(DummyController.prototype.withoutRoles, {
      sub: 'staff-4',
      isGuest: false,
      isAdmin: true,
      roles: [],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('маршрут с метаданными, но request.user отсутствует -> 403 (безопасно по умолчанию, не пропускает)', () => {
    const guard = buildGuard();
    const context = buildContext(
      DummyController.prototype.withRoles,
      undefined,
    );

    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  it('@Roles на КЛАССЕ (без @Roles на методе): у сотрудника нет требуемой роли -> 403 ADMIN_FORBIDDEN, а не молчаливый пропуск', () => {
    const guard = buildGuard();
    const context = buildContext(
      DummyControllerWithClassRoles.prototype.noOwnRoles,
      { sub: 'staff-5', isGuest: false, isAdmin: true, roles: [] },
      DummyControllerWithClassRoles,
    );

    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
      fail('ожидалось исключение');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(403);
    }
  });

  it('@Roles на классе: у сотрудника есть роль класса -> пропускает', () => {
    const guard = buildGuard();
    const context = buildContext(
      DummyControllerWithClassRoles.prototype.noOwnRoles,
      {
        sub: 'staff-6',
        isGuest: false,
        isAdmin: true,
        roles: [AdminRole.FINANCE_CONTROL],
      },
      DummyControllerWithClassRoles,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('@Roles на методе переопределяет @Roles на классе (getAllAndOverride): роль класса не пропускает метод со своими ролями', () => {
    const guard = buildGuard();
    const context = buildContext(
      DummyControllerWithClassRoles.prototype.overridesClassRoles,
      {
        sub: 'staff-7',
        isGuest: false,
        isAdmin: true,
        roles: [AdminRole.FINANCE_CONTROL],
      },
      DummyControllerWithClassRoles,
    );

    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });
});
