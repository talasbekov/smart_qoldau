import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/filters/app-exception.filter';
import { SMS_PROVIDER_TOKEN, SmsProvider } from './sms/sms.provider';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    @Inject(SMS_PROVIDER_TOKEN) private sms: SmsProvider,
  ) {}

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
}
