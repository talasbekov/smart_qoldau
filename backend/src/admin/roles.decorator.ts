import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const ADMIN_ROLES_KEY = 'adminRoles';

// Метаданные ролей, требуемых для маршрута админки. RolesGuard читает их
// через Reflector: пропускает, если у сотрудника есть хотя бы одна из
// перечисленных ролей ИЛИ роль SUPERADMIN; при отсутствии декоратора на
// маршруте — пропускает (доступ уже ограничен AdminJwtGuard).
export const Roles = (...roles: AdminRole[]) =>
  SetMetadata(ADMIN_ROLES_KEY, roles);
