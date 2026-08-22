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

const BCRYPT_ROUNDS = 10; // как в auth.service.ts / admin-bootstrap.service.ts

// Фиктивный bcrypt-хеш для сравнения, когда email не найден: bcrypt.compare
// занимает сопоставимое время что для найденного, что для отсутствующего
// сотрудника — иначе разница во времени ответа выдала бы существование
// учётной записи ещё до сравнения тел ответов.
const DUMMY_HASH = bcrypt.hashSync('admin-auth-dummy-password', BCRYPT_ROUNDS);

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

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    admin: AdminSummary;
  }> {
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
}
