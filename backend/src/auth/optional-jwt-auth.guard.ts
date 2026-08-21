import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { apiError } from '../common/filters/app-exception.filter';
import { JwtPayload } from './jwt.strategy';

// Как JwtAuthGuard, но не требует токена. Различает ТРИ случая (важно: они
// НЕ эквивалентны — см. code review задачи 7 и финальное ревью E8a, п.5):
// - заголовка Authorization нет вовсе -> запрос гостевой, request.user = null;
// - заголовок есть, но токен невалиден/просрочен/подписан не тем секретом ->
//   401, как у обычного JwtAuthGuard. Молчаливый откат авторизованного
//   пользователя с протухшим токеном в "гостя" маскирует реальную причину
//   отказа под неродственные ошибки (TICKET_CONTACT_REQUIRED и т.п.) и рвёт
//   связь тикета с аккаунтом.
// - заголовок есть, токен ВАЛИДЕН, но это токен сотрудника админки
//   (payload.isAdmin === true) -> 403 FORBIDDEN, симметрично JwtAuthGuard.
//   Без этой ветки сотрудник с админским токеном в браузере (эпик E8, токен
//   лежит рядом с пользовательскими вызовами) молча создавал бы обращение
//   как CLIENT/EXPERT с authorUserId, указывающим на несуществующего
//   пользователя (id из admin_users) — в обход требования контакта для
//   гостя, с уведомлением, отправленным в никуда (confused deputy).
// Единственный потребитель: POST /v1/tickets (E8a, задача 7) — гость создаёт
// обращение без токена, авторизованный клиент/эксперт — с ним, причём тип
// автора сервер определяет сам (см. TicketsService.resolveAuthor), а не из
// тела запроса.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = JwtPayload>(
    err: unknown,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (user) {
      if ((user as JwtPayload).isAdmin === true) {
        apiError('FORBIDDEN', 'Доступ только для пользователей', 403);
      }
      return user;
    }

    // Наличие самого заголовка (а не разбор текста ошибки passport-jwt,
    // которая для "нет токена" и "невалидный токен" — обе просто fail(),
    // err здесь null в обоих случаях) — единственный надёжный сигнал о том,
    // что клиент ПЫТАЛСЯ авторизоваться.
    const request = context.switchToHttp().getRequest();
    const hasAuthHeader = Boolean(request.headers?.authorization);
    if (!hasAuthHeader && !err) return null as TUser;

    throw err instanceof Error ? err : new UnauthorizedException();
  }
}
