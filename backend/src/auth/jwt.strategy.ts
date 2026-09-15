import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AdminRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccountAccessService } from './account-access.service';

// isAdmin/roles заполняются только для токенов сотрудников админки (E8a,
// AdminAuthService.login) — пользовательские/гостевые токены их не несут.
export interface JwtPayload {
  sub: string;
  isGuest: boolean;
  isAdmin?: true;
  roles?: AdminRole[];
  // Незавершённый вход сотрудника: первый шаг двухфакторной аутентификации
  // (E11a, задача 5). Такой токен НЕ открывает рабочие маршруты — см.
  // AdminJwtGuard. Поле обязано доезжать до guard'а, поэтому оно здесь, а
  // не отбрасывается вместе с прочими claim'ами.
  stage?: 'totp';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly access: AccountAccessService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Staff state is checked separately by AdminJwtGuard.
    if (!payload.isAdmin) await this.access.assertActive(payload.sub);
    const result: JwtPayload = { sub: payload.sub, isGuest: payload.isGuest };
    if (payload.isAdmin) result.isAdmin = payload.isAdmin;
    if (payload.roles) result.roles = payload.roles;
    if (payload.stage) result.stage = payload.stage;
    return result;
  }
}
