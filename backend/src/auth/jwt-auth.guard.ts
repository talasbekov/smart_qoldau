import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { apiError } from '../common/filters/app-exception.filter';
import { JwtPayload } from './jwt.strategy';

// Наследник AuthGuard('jwt'): отсутствие/невалидность/просроченность токена
// по-прежнему даёт стандартный 401 из passport (см. handleRequest в
// @nestjs/passport). Дополнительно отклоняет токен сотрудника админки
// (payload.isAdmin === true) — симметрично AdminJwtGuard, который отклоняет
// пользовательский токен на админских маршрутах. Без этой проверки токен
// сотрудника молча принимался бы ЛЮБЫМ пользовательским маршрутом (confused
// deputy, финальное ревью E8a, п.5) -> 403 FORBIDDEN.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = JwtPayload>(
    err: unknown,
    user: JwtPayload | false,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    const payload = super.handleRequest(
      err,
      user,
      info,
      context,
      status,
    ) as JwtPayload;
    if (payload.isAdmin === true) {
      apiError('FORBIDDEN', 'Доступ только для пользователей', 403);
    }
    return payload as TUser;
  }
}
