import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { apiError } from '../common/filters/app-exception.filter';
import { JwtPayload } from '../auth/jwt.strategy';

// Наследник AuthGuard('jwt'): отсутствие/невалидность/просроченность токена
// по-прежнему даёт стандартный 401 из passport (см. handleRequest в
// @nestjs/passport). Дополнительно после проверки подписи требует
// payload.isAdmin === true — пользовательский (клиентский/экспертный/
// гостевой) токен не несёт этого поля и не открывает админку -> 403
// ADMIN_FORBIDDEN.
@Injectable()
export class AdminJwtGuard extends AuthGuard('jwt') {
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
    if (payload.isAdmin !== true) {
      apiError('ADMIN_FORBIDDEN', 'Доступ только для сотрудников админки', 403);
    }
    return payload as TUser;
  }
}
