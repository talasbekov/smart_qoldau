import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt.strategy';

export interface CurrentAdminPayload {
  id: string;
  roles: AdminRole[];
}

// Используется вместе с JwtAuthGuard на защищённых админ-эндпоинтах
// (задачи 4-10) — читает request.user, заполненный JwtStrategy.validate.
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentAdminPayload => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return { id: user.sub, roles: user.roles ?? [] };
  },
);
