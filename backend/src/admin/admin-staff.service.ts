import { Injectable } from '@nestjs/common';
import { AdminRole, AdminUser } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/filters/app-exception.filter';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AdminAuthService } from './admin-auth.service';
import { AdminSessionService } from './admin-session.service';
import { StaffCardDto, StaffDto } from './dto/staff.dto';

const BCRYPT_ROUNDS = 10; // как в admin-auth.service.ts / admin-bootstrap.service.ts

// CRUD сотрудников админки (E8a, задача 6). Отдельный сервис от
// AdminAuthService — у того ответственность только за вход по паролю.
@Injectable()
export class AdminStaffService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private adminAuth: AdminAuthService,
    private session: AdminSessionService,
  ) {}

  async create(dto: CreateStaffDto, actorId: string): Promise<StaffDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let created: AdminUser;
    try {
      created = await this.prisma.adminUser.create({
        data: { email: dto.email, passwordHash, roles: dto.roles },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002')
        apiError(
          'STAFF_EMAIL_EXISTS',
          'Сотрудник с таким email уже существует',
          409,
        );
      throw e;
    }

    await this.audit.log({
      actorType: 'admin',
      actorId,
      entity: 'staff',
      entityId: created.id,
      transition: 'staff.created',
      payload: { email: created.email, roles: created.roles },
    });

    return this.toStaffDto(created);
  }

  async list(filters: {
    take?: number;
    skip?: number;
  }): Promise<{ items: StaffCardDto[]; total: number }> {
    const take = Math.min(filters.take ?? 20, 100);
    const skip = filters.skip ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        // Вторичный ключ id: createdAt (мс-разрешение) может совпасть у
        // сотрудников, созданных подряд — без тай-брейкера skip/take по
        // неполному ORDER BY недетерминированы между страницами.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        skip,
      }),
      this.prisma.adminUser.count(),
    ]);

    return { items: items.map((i) => this.toStaffCardDto(i)), total };
  }

  async update(
    id: string,
    dto: UpdateStaffDto,
    actor: { id: string },
  ): Promise<StaffCardDto> {
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) apiError('STAFF_NOT_FOUND', 'Сотрудник не найден', 404);

    // Суперадмин не может деактивировать самого себя или снять с себя роль
    // SUPERADMIN через этот эндпоинт. Причина: isActive/роли проверяются
    // только при входе (JWT stateless в рамках сессии, задачи 1-5) — своё
    // собственное отключение не оборвёт текущую сессию сразу, но при
    // следующем входе (либо у любого другого суперадмина, если это
    // последний) может не остаться ни одного действующего суперадмина,
    // способного исправить ситуацию через этот же API. Явный запрет с
    // понятным кодом дешевле, чем случайная самоблокировка админки.
    if (id === actor.id) {
      if (dto.isActive === false)
        apiError(
          'STAFF_SELF_LOCKOUT_FORBIDDEN',
          'Нельзя деактивировать самого себя',
          400,
        );
      if (dto.roles && !dto.roles.includes(AdminRole.SUPERADMIN))
        apiError(
          'STAFF_SELF_LOCKOUT_FORBIDDEN',
          'Нельзя снять с себя роль SUPERADMIN',
          400,
        );
    }

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: {
        ...(dto.roles !== undefined ? { roles: dto.roles } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    const changes: Record<string, unknown> = {};
    if (dto.roles !== undefined) changes.roles = dto.roles;
    if (dto.isActive !== undefined) changes.isActive = dto.isActive;

    await this.audit.log({
      actorType: 'admin',
      actorId: actor.id,
      entity: 'staff',
      entityId: updated.id,
      transition: 'staff.updated',
      payload: changes,
    });

    if (dto.isActive === false) {
      // Деактивация действует НЕМЕДЛЕННО: отзываем refresh-токены и
      // сбрасываем кэш актуальности, не дожидаясь его TTL.
      await this.adminAuth.revokeAccess(updated.id);
    } else if (dto.roles !== undefined) {
      // Смена ролей — тоже без ожидания TTL: иначе снятая роль ещё
      // полминуты действует.
      await this.session.invalidate(updated.id);
    }

    return this.toStaffCardDto(updated);
  }

  private toStaffDto(admin: AdminUser): StaffDto {
    return {
      id: admin.id,
      email: admin.email,
      roles: admin.roles,
      isActive: admin.isActive,
    };
  }

  private toStaffCardDto(admin: AdminUser): StaffCardDto {
    return {
      ...this.toStaffDto(admin),
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
    };
  }
}
