import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { apiError } from '../common/filters/app-exception.filter';
import { JwtPayload } from '../auth/jwt.strategy';
import { ADMIN_ROLES_KEY } from './roles.decorator';

// Применяется ПОСЛЕ AdminJwtGuard: сверяет роли сотрудника (request.user.roles,
// заполненные JwtStrategy.validate) с метаданными @Roles на маршруте.
// - Нет @Roles на маршруте -> пропускает (доступ уже ограничен AdminJwtGuard).
// - Есть @Roles -> пропускает, если у сотрудника есть хотя бы одна из
//   требуемых ролей ИЛИ роль SUPERADMIN.
// - Иначе, включая случай отсутствия request.user/roles (AdminJwtGuard по
//   какой-то причине не отработал) -> 403 ADMIN_FORBIDDEN. Безопасен по
//   умолчанию: отсутствие данных о ролях не пропускает запрос.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<AdminRole[]>(
      ADMIN_ROLES_KEY,
      context.getHandler(),
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const roles = user?.roles ?? [];

    const allowed =
      roles.includes(AdminRole.SUPERADMIN) ||
      requiredRoles.some((role) => roles.includes(role));

    if (!allowed) {
      apiError('ADMIN_FORBIDDEN', 'Недостаточно прав для этого действия', 403);
    }
    return true;
  }
}
