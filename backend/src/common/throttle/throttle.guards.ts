import { ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

// Общий предок: превышение лимита отдаётся в том же формате, что и все
// остальные ошибки проекта (`{error:{code,message}}`), а не собственным
// форматом ThrottlerException — иначе клиент, разбирающий `error.code`,
// на 429 увидит пустоту.
@Injectable()
class SqThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    _context: ExecutionContext,
    _detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      {
        code: 'RATE_LIMITED',
        message: 'Слишком много запросов, попробуйте позже',
      },
      429,
    );
  }
}

/// Лимит по IP — для эндпоинтов без аутентификации и без стабильного
/// идентификатора отправителя.
@Injectable()
export class IpThrottlerGuard extends SqThrottlerGuard {}

/// Лимит по email из тела запроса (вход сотрудника). Сотрудники сидят за
/// одним офисным IP: перебор чужого ящика не должен запирать соседа.
@Injectable()
export class AdminLoginThrottlerGuard extends SqThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const email = req.body?.email;
    return typeof email === 'string' && email.length > 0
      ? `admin-login:${email.toLowerCase()}`
      : `admin-login-ip:${req.ip}`;
  }
}

/// Лимит по телефону из тела запроса (SMS): платит проект, а не владелец IP.
@Injectable()
export class PhoneThrottlerGuard extends SqThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const phone = req.body?.phone;
    return typeof phone === 'string' && phone.length > 0
      ? `phone:${phone}`
      : `phone-ip:${req.ip}`;
  }
}

/// Лимит по пользователю из JWT — иначе за одним NAT-адресом весь офис
/// делит один лимит на заявки.
@Injectable()
export class UserThrottlerGuard extends SqThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.sub;
    return typeof userId === 'string' ? `user:${userId}` : `ip:${req.ip}`;
  }
}
