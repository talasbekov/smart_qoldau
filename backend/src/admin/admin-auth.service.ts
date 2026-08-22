import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/filters/app-exception.filter';
import { AdminSessionService } from './admin-session.service';
import { AdminTotpService } from './admin-totp.service';

const BCRYPT_ROUNDS = 10; // как в auth.service.ts / admin-bootstrap.service.ts

// Фиктивный bcrypt-хеш для сравнения, когда email не найден: bcrypt.compare
// занимает сопоставимое время что для найденного, что для отсутствующего
// сотрудника — иначе разница во времени ответа выдала бы существование
// учётной записи ещё до сравнения тел ответов.
const DUMMY_HASH = bcrypt.hashSync('admin-auth-dummy-password', BCRYPT_ROUNDS);

/// Ответ на вход: либо готовая сессия, либо требование второго фактора.
export type AdminLoginResult =
  | { accessToken: string; refreshToken: string; admin: AdminSummary }
  | { totpRequired: true; challengeToken: string };

export interface AdminSummary {
  id: string;
  email: string;
  roles: AdminRole[];
}

@Injectable()
export class AdminAuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
    private session: AdminSessionService,
    private totp: AdminTotpService,
    private config: ConfigService,
  ) {}

  /// Refresh-токен хранится ХЕШЕМ, как пользовательский: утечка таблицы не
  /// должна давать возможность войти.
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async issueSession(admin: {
    id: string;
    email: string;
    roles: AdminRole[];
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    admin: AdminSummary;
  }> {
    const accessToken = await this.jwt.signAsync({
      sub: admin.id,
      isGuest: false,
      isAdmin: true,
      roles: admin.roles,
    });

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const days = Number(this.config.get('JWT_REFRESH_TTL_DAYS', '30'));
    await this.prisma.adminRefreshToken.create({
      data: {
        adminUserId: admin.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 24 * 3600_000),
      },
    });

    return {
      accessToken,
      refreshToken,
      admin: { id: admin.id, email: admin.email, roles: admin.roles },
    };
  }

  /// Продление сессии с РОТАЦИЕЙ: старый токен отзывается тут же, поэтому
  /// перехваченный экземпляр второй раз не сработает.
  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    admin: AdminSummary;
  }> {
    const stored = await this.prisma.adminRefreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
      include: { adminUser: true },
    });

    if (
      !stored ||
      stored.revokedAt !== null ||
      stored.expiresAt <= new Date() ||
      !stored.adminUser.isActive
    ) {
      apiError('ADMIN_INVALID_CREDENTIALS', 'Сессия недействительна', 401);
    }

    await this.prisma.adminRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const session = await this.issueSession(stored.adminUser);

    await this.audit.log({
      actorType: 'admin',
      actorId: stored.adminUserId,
      entity: 'staff',
      entityId: stored.adminUserId,
      transition: 'admin.session_refreshed',
    });

    return session;
  }

  /// Отзыв доступа: токены аннулируются, кэш актуальности сбрасывается —
  /// деактивация действует немедленно, а не через TTL.
  async revokeAccess(adminUserId: string): Promise<void> {
    await this.prisma.adminRefreshToken.updateMany({
      where: { adminUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.session.invalidate(adminUserId);
    await this.audit.log({
      actorType: 'admin',
      entity: 'staff',
      entityId: adminUserId,
      transition: 'admin.access_revoked',
    });
  }

  async login(email: string, password: string): Promise<AdminLoginResult> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    const passwordValid = await bcrypt.compare(
      password,
      admin?.passwordHash ?? DUMMY_HASH,
    );

    // Неверный email ИЛИ пароль ИЛИ заблокированный сотрудник -> один и тот
    // же ответ: не раскрываем существование учётной записи.
    if (!admin || !admin.isActive || !passwordValid) {
      await this.audit.log({
        actorType: 'admin',
        entity: 'staff',
        entityId: admin?.id ?? email,
        transition: 'admin.login_failed',
        payload: { email },
      });
      apiError('ADMIN_INVALID_CREDENTIALS', 'Неверный email или пароль', 401);
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Второй фактор включён — пары токенов на этом шаге нет. challengeToken
    // подписан отдельным назначением: рабочие маршруты им не открываются,
    // это доказывается его полем `stage`, которого нет у обычного токена.
    if (updated.totpEnabledAt !== null) {
      const challengeToken = await this.jwt.signAsync(
        { sub: updated.id, isAdmin: true, stage: 'totp' },
        { expiresIn: '5m' },
      );
      return { totpRequired: true as const, challengeToken };
    }

    const session = await this.issueSession(updated);

    await this.audit.log({
      actorType: 'admin',
      actorId: updated.id,
      entity: 'staff',
      entityId: updated.id,
      transition: 'admin.logged_in',
    });

    return session;
  }

  /// Привязка второго фактора. Секрет и коды восстановления покидают сервер
  /// РОВНО здесь и больше нигде: дальше в базе только шифротекст и хеши.
  async totpSetup(adminUserId: string): Promise<{
    secret: string;
    otpauthUrl: string;
    recoveryCodes: string[];
  }> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: adminUserId },
    });
    if (admin.totpEnabledAt !== null) {
      apiError('TOTP_ALREADY_ENABLED', 'Второй фактор уже включён', 409);
    }

    const secret = this.totp.generateSecret();
    const recoveryCodes = this.totp.generateRecoveryCodes();

    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: adminUserId },
        data: { totpSecret: this.totp.encryptSecret(secret) },
      }),
      // Старые неподтверждённые коды не копятся: повторный setup до
      // подтверждения перегенерирует всё.
      this.prisma.adminRecoveryCode.deleteMany({ where: { adminUserId } }),
      this.prisma.adminRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({
          adminUserId,
          codeHash: this.totp.hashRecoveryCode(code),
        })),
      }),
    ]);

    return {
      secret,
      otpauthUrl: this.totp.otpauthUrl(admin.email, secret),
      recoveryCodes,
    };
  }

  /// Подтверждение привязки: без него 2FA не включается — иначе сотрудник
  /// запирал бы себя, не проверив, что приложение действительно настроено.
  async totpConfirm(adminUserId: string, code: string): Promise<void> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: adminUserId },
    });
    if (admin.totpEnabledAt !== null) {
      apiError('TOTP_ALREADY_ENABLED', 'Второй фактор уже включён', 409);
    }
    if (!admin.totpSecret) {
      apiError('TOTP_NOT_INITIALIZED', 'Сначала выполните привязку', 409);
    }

    const valid = await this.totp.verify(
      adminUserId,
      this.totp.decryptSecret(admin.totpSecret),
      code,
    );
    if (!valid) {
      await this.audit.log({
        actorType: 'admin',
        actorId: adminUserId,
        entity: 'staff',
        entityId: adminUserId,
        transition: 'admin.totp_failed',
      });
      apiError('TOTP_INVALID', 'Неверный код', 401);
    }

    await this.prisma.adminUser.update({
      where: { id: adminUserId },
      data: { totpEnabledAt: new Date() },
    });
    await this.audit.log({
      actorType: 'admin',
      actorId: adminUserId,
      entity: 'staff',
      entityId: adminUserId,
      transition: 'admin.totp_enabled',
    });
  }

  /// Второй шаг входа: код из приложения ИЛИ одноразовый код
  /// восстановления.
  async totpVerify(
    challengeToken: string,
    code: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    admin: AdminSummary;
  }> {
    let payload: { sub: string; stage?: string };
    try {
      payload = await this.jwt.verifyAsync(challengeToken);
    } catch {
      apiError('ADMIN_INVALID_CREDENTIALS', 'Сессия недействительна', 401);
    }
    if (payload.stage !== 'totp') {
      apiError('ADMIN_INVALID_CREDENTIALS', 'Сессия недействительна', 401);
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });
    if (!admin || !admin.isActive || !admin.totpSecret) {
      apiError('ADMIN_INVALID_CREDENTIALS', 'Сессия недействительна', 401);
    }

    const byApp = await this.totp.verify(
      admin.id,
      this.totp.decryptSecret(admin.totpSecret),
      code,
    );
    const accepted = byApp || (await this.consumeRecoveryCode(admin.id, code));

    if (!accepted) {
      await this.audit.log({
        actorType: 'admin',
        actorId: admin.id,
        entity: 'staff',
        entityId: admin.id,
        transition: 'admin.totp_failed',
      });
      apiError('TOTP_INVALID', 'Неверный код', 401);
    }

    await this.audit.log({
      actorType: 'admin',
      actorId: admin.id,
      entity: 'staff',
      entityId: admin.id,
      transition: 'admin.logged_in',
    });
    return this.issueSession(admin);
  }

  /// Код восстановления одноразовый: гасим его в той же операции, что и
  /// проверяем, чтобы параллельные попытки не прошли обе.
  private async consumeRecoveryCode(
    adminUserId: string,
    code: string,
  ): Promise<boolean> {
    const codeHash = this.totp.hashRecoveryCode(code);
    const consumed = await this.prisma.adminRecoveryCode.updateMany({
      where: { adminUserId, codeHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) return false;

    await this.audit.log({
      actorType: 'admin',
      actorId: adminUserId,
      entity: 'staff',
      entityId: adminUserId,
      transition: 'admin.recovery_code_used',
    });
    return true;
  }
}
