import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/filters/app-exception.filter';
import { SMS_PROVIDER_TOKEN, SmsProvider } from './sms/sms.provider';

@Injectable()
export class AuthService {
  private readonly refreshTtlDays: number;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject(SMS_PROVIDER_TOKEN) private sms: SmsProvider,
    private audit: AuditService,
  ) {
    this.refreshTtlDays = this.config.get<number>('JWT_REFRESH_TTL_DAYS')!;
  }

  async requestCode(phone: string): Promise<void> {
    const existing = await this.prisma.smsCode.findUnique({ where: { phone } });
    if (existing && Date.now() - existing.lastSentAt.getTime() < 45_000)
      apiError(
        'SMS_RATE_LIMITED',
        'Повторная отправка возможна через 45 секунд',
        429,
      );
    const code = String(randomInt(0, 10_000)).padStart(4, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const data = {
      codeHash,
      attempts: 0,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60_000),
    };
    await this.prisma.smsCode.upsert({
      where: { phone },
      update: data,
      create: { phone, ...data },
    });
    await this.sms.send(phone, `SmartQoldau: код входа ${code}`);
  }

  async verifyCode(
    phone: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    await this.checkCode(phone, code);

    // Проверяем, существует ли пользователь до upsert
    const existingUser = await this.prisma.user.findUnique({ where: { phone } });

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    // Логируем события только при создании нового пользователя
    if (!existingUser) {
      await this.audit.log({
        actorType: 'user',
        actorId: user.id,
        entity: 'user',
        entityId: user.id,
        transition: 'user.registered',
      });
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }

  /**
   * Проверяет SMS-код для телефона: истечение, число попыток, соответствие
   * хэшу. При успехе удаляет запись SmsCode. При неудаче атомарно
   * инкрементирует attempts и бросает apiError (поведение не меняется
   * относительно исходного verifyCode).
   */
  private async checkCode(phone: string, code: string): Promise<void> {
    const smsCode = await this.prisma.smsCode.findUnique({ where: { phone } });
    if (!smsCode || smsCode.expiresAt < new Date())
      apiError('SMS_CODE_EXPIRED', 'Код истёк, запросите новый', 400);
    if (smsCode.attempts >= 5)
      apiError('SMS_CODE_INVALID', 'Превышено число попыток', 400);

    const valid = await bcrypt.compare(code, smsCode.codeHash);
    if (!valid) {
      await this.prisma.smsCode.updateMany({
        where: { phone },
        data: { attempts: { increment: 1 } },
      });
      apiError('SMS_CODE_INVALID', 'Неверный код', 400);
    }

    await this.prisma.smsCode.delete({ where: { phone } });
  }

  async issueTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      isGuest: user.isGuest,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        expiresAt: new Date(Date.now() + this.refreshTtlDays * 86_400_000),
      },
    });
    return { accessToken, refreshToken };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    // findUnique — только чтобы получить user; решение об отказе принимается
    // исключительно по count атомарного updateMany ниже.
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    // Атомарная ротация: отзыв срабатывает ровно один раз — параллельный
    // refresh того же токена получит count === 0 и 401.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (count !== 1 || !existing)
      apiError('UNAUTHORIZED', 'Refresh-токен недействителен', 401);

    // Логируем успешную ротацию refresh-токена
    await this.audit.log({
      actorType: 'user',
      actorId: existing.user.id,
      entity: 'auth',
      entityId: existing.user.id,
      transition: 'auth.refresh_rotated',
    });

    const tokens = await this.issueTokens(existing.user);
    return { ...tokens, user: existing.user };
  }

  async guest(
    deviceId: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    let user = await this.prisma.user.findFirst({
      where: { deviceId, isGuest: true },
    });
    let isNewGuest = false;
    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: { deviceId, isGuest: true },
        });
        isNewGuest = true;
      } catch (e) {
        // Гонка двух параллельных гостевых входов с одним deviceId: частичный
        // уникальный индекс users_device_id_guest_uq даёт P2002 проигравшему —
        // перечитываем и выдаём токены уже созданному гостю.
        if (!(e instanceof PrismaClientKnownRequestError && e.code === 'P2002'))
          throw e;
        user = await this.prisma.user.findFirst({
          where: { deviceId, isGuest: true },
        });
        if (!user) throw e;
      }
    }
    if (isNewGuest) {
      await this.audit.log({
        actorType: 'system',
        entity: 'user',
        entityId: user.id,
        transition: 'user.guest_created',
      });
    }
    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }

  async convertGuest(
    userId: string,
    phone: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    await this.checkCode(phone, code);

    // Быстрый путь: телефон уже занят другим пользователем.
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== userId)
      apiError(
        'PHONE_ALREADY_REGISTERED',
        'Номер уже используется другим аккаунтом',
        409,
      );

    let user: User;
    try {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { phone, isGuest: false },
      });
    } catch (e) {
      // TOCTOU: между findUnique выше и update телефон могли занять параллельной
      // конверсией/регистрацией — unique(phone) даёт P2002; отдаём 409, а не 500.
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002')
        apiError(
          'PHONE_ALREADY_REGISTERED',
          'Номер уже используется другим аккаунтом',
          409,
        );
      throw e;
    }

    // Логируем конверсию гостя в пользователя с телефоном
    await this.audit.log({
      actorType: 'user',
      actorId: user.id,
      entity: 'user',
      entityId: user.id,
      transition: 'user.guest_converted',
      payload: { phone },
    });

    // Отзыв всех активных refresh-токенов гостя: старые сессии по этому
    // deviceId больше не должны продолжать работать после конверсии.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }
}
