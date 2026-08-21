import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Как JwtAuthGuard, но не бросает 401 при отсутствии/невалидности токена —
// request.user остаётся null. Единственный на сегодня потребитель: POST
// /v1/tickets (E8a, задача 7) — гость создаёт обращение без токена,
// авторизованный клиент/эксперт — с ним, причём тип автора сервер определяет
// сам (см. TicketsService.resolveAuthor), а не из тела запроса.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    return (user || null) as TUser;
  }
}
