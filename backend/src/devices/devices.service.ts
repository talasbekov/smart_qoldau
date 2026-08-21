import { Injectable } from '@nestjs/common';
import { Device, DevicePlatform } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/filters/app-exception.filter';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  // upsert по глобально-уникальному token: телефон сменил владельца аккаунта
  // -> токен ПЕРЕПРИВЯЗЫВАЕТСЯ к новому пользователю (пуш старому владельцу
  // на чужое устройство — утечка). locale устройства заодно обновляет
  // локаль пользователя — шаблоны уведомлений рендерятся по User.locale.
  async register(
    userId: string,
    input: { platform: DevicePlatform; token: string; locale?: string },
  ): Promise<Device> {
    const device = await this.prisma.device.upsert({
      where: { token: input.token },
      create: {
        userId,
        platform: input.platform,
        token: input.token,
        locale: input.locale ?? 'ru',
      },
      update: {
        userId,
        platform: input.platform,
        ...(input.locale ? { locale: input.locale } : {}),
      },
    });

    if (input.locale) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { locale: input.locale },
      });
    }

    return device;
  }

  // Только своё устройство: чужой token -> 404 (существование чужих токенов
  // не раскрываем кодом 403).
  async remove(userId: string, token: string): Promise<void> {
    const deleted = await this.prisma.device.deleteMany({
      where: { token, userId },
    });
    if (deleted.count === 0) {
      apiError('DEVICE_NOT_FOUND', 'Устройство не найдено', 404);
    }
  }

  async updateLocale(userId: string, locale: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { locale },
    });
  }
}
