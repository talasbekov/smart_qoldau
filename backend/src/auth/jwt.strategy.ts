import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AdminRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

// isAdmin/roles заполняются только для токенов сотрудников админки (E8a,
// AdminAuthService.login) — пользовательские/гостевые токены их не несут.
export interface JwtPayload {
  sub: string;
  isGuest: boolean;
  isAdmin?: true;
  roles?: AdminRole[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const result: JwtPayload = { sub: payload.sub, isGuest: payload.isGuest };
    if (payload.isAdmin) result.isAdmin = payload.isAdmin;
    if (payload.roles) result.roles = payload.roles;
    return result;
  }
}
