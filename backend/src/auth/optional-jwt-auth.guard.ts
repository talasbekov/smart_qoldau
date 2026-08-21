import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Как JwtAuthGuard, но не требует токена. Различает ДВА разных случая
// (важно: они НЕ эквивалентны — см. code review задачи 7):
// - заголовка Authorization нет вовсе -> запрос гостевой, request.user = null;
// - заголовок есть, но токен невалиден/просрочен/подписан не тем секретом ->
//   401, как у обычного JwtAuthGuard. Молчаливый откат авторизованного
//   пользователя с протухшим токеном в "гостя" маскирует реальную причину
//   отказа под неродственные ошибки (TICKET_CONTACT_REQUIRED и т.п.) и рвёт
//   связь тикета с аккаунтом.
// Единственный потребитель: POST /v1/tickets (E8a, задача 7) — гость создаёт
// обращение без токена, авторизованный клиент/эксперт — с ним, причём тип
// автора сервер определяет сам (см. TicketsService.resolveAuthor), а не из
// тела запроса.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (user) return user;

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
