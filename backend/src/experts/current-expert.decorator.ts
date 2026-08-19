import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Expert } from '@prisma/client';

// Достаёт req.expert, положенный ExpertGuard-ом.
export const CurrentExpert = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Expert => {
    const request = ctx.switchToHttp().getRequest();
    return request.expert as Expert;
  },
);
