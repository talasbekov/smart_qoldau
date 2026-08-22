import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { apiError } from '../common/filters/app-exception.filter';
import { JwtPayload } from '../auth/jwt.strategy';
import { AdminSessionService } from './admin-session.service';

// Наследник AuthGuard('jwt'): отсутствие/невалидность/просроченность токена
// по-прежнему даёт стандартный 401 из passport (см. handleRequest в
// @nestjs/passport). Дополнительно после проверки подписи требует
// payload.isAdmin === true — пользовательский (клиентский/экспертный/
// гостевой) токен не несёт этого поля и не открывает админку -> 403
// ADMIN_FORBIDDEN.
@Injectable()
export class AdminJwtGuard extends AuthGuard('jwt') {
  constructor(private session: AdminSessionService) {
    super();
  }

  /// Маршруты привязки второго фактора — единственное, что доступно
  /// сотруднику без 2FA при TOTP_REQUIRED=true. Иначе включить её было бы
  /// невозможно: любой запрос отвергался бы.
  private isTotpSetupRoute(path: string): boolean {
    return (
      path.endsWith('/admin/auth/totp/setup') ||
      path.endsWith('/admin/auth/totp/confirm')
    );
  }

  // Подпись токена — не единственное условие доступа (E11a, задача 4):
  // после неё сверяется АКТУАЛЬНОЕ состояние сотрудника. Иначе
  // деактивированный работает до истечения токена, а снятая роль не
  // действует вовсе — роли раньше брались из payload'а.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const request = context.switchToHttp().getRequest();
    const payload = request.user as JwtPayload;

    // Токен первого шага двухфакторного входа (E11a, задача 5) несёт
    // `stage: 'totp'` и не открывает НИ ОДИН рабочий маршрут: иначе знание
    // пароля давало бы доступ, а второй фактор оставался бы формальностью.
    if (payload.stage === 'totp') {
      apiError('ADMIN_INVALID_CREDENTIALS', 'Вход не завершён', 401);
    }

    const state = await this.session.stateOf(payload.sub);

    if (!state || !state.isActive) {
      apiError('ADMIN_INVALID_CREDENTIALS', 'Сессия недействительна', 401);
    }

    if (
      // Читается из process.env на каждый запрос, а не через ConfigService:
      // валидированный конфиг снимается один раз при инициализации, а
      // требование второго фактора должно включаться и в уже запущенном
      // приложении (и в e2e — тем же способом, что THROTTLE_ENABLED).
      process.env.TOTP_REQUIRED === 'true' &&
      !state.totpEnabled &&
      !this.isTotpSetupRoute(request.url ?? '')
    ) {
      apiError(
        'TOTP_SETUP_REQUIRED',
        'Включите второй фактор, чтобы продолжить',
        403,
      );
    }

    // Роли подменяются свежими: RolesGuard читает их из request.user.
    request.user = { ...payload, roles: state.roles };
    return true;
  }

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
