import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/filters/app-exception.filter';

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
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; admin: AdminSummary }> {
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

    const accessToken = await this.jwt.signAsync({
      sub: updated.id,
      isGuest: false,
      isAdmin: true,
      roles: updated.roles,
    });

    await this.audit.log({
      actorType: 'admin',
      actorId: updated.id,
      entity: 'staff',
      entityId: updated.id,
      transition: 'admin.logged_in',
    });

    return {
      accessToken,
      admin: { id: updated.id, email: updated.email, roles: updated.roles },
    };
  }
}
