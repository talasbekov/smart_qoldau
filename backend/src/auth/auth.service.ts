import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
    const smsCode = await this.prisma.smsCode.findUnique({ where: { phone } });
    if (!smsCode || smsCode.expiresAt < new Date())
      apiError('SMS_CODE_EXPIRED', 'Код истёк, запросите новый', 400);
    if (smsCode.attempts >= 5)
      apiError('SMS_CODE_INVALID', 'Превышено число попыток', 400);

    const valid = await bcrypt.compare(code, smsCode.codeHash);
    if (!valid) {
      await this.prisma.smsCode.update({
        where: { phone },
        data: { attempts: { increment: 1 } },
      });
      apiError('SMS_CODE_INVALID', 'Неверный код', 400);
    }

    await this.prisma.smsCode.delete({ where: { phone } });
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
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
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date())
      apiError('UNAUTHORIZED', 'Refresh-токен недействителен', 401);

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(existing.user);
    return { ...tokens, user: existing.user };
  }
}
