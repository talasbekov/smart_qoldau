import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/filters/app-exception.filter';
import { PaymentProviderPort } from './provider/payment-provider.port';
import { AddPaymentMethodDto } from './dto/add-payment-method.dto';
import { PaymentMethodDto } from './dto/payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private prisma: PrismaService,
    private provider: PaymentProviderPort,
  ) {}

  async add(
    userId: string,
    dto: AddPaymentMethodDto,
  ): Promise<PaymentMethodDto> {
    const { token, maskedPan, brand } = await this.provider.tokenizeCard({
      pan: dto.pan,
      expiry: dto.expiry,
      holderName: dto.holderName,
    });

    const created = await this.prisma.paymentMethod.create({
      data: {
        userId,
        providerToken: token,
        maskedPan,
        brand,
        holderName: dto.holderName,
      },
    });

    return {
      id: created.id,
      maskedPan: created.maskedPan,
      brand: created.brand,
      holderName: created.holderName,
    };
  }

  async list(userId: string): Promise<PaymentMethodDto[]> {
    const methods = await this.prisma.paymentMethod.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return methods.map((m) => ({
      id: m.id,
      maskedPan: m.maskedPan,
      brand: m.brand,
      holderName: m.holderName,
    }));
  }

  async remove(userId: string, id: string): Promise<void> {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!method) {
      apiError('PAYMENT_METHOD_NOT_FOUND', 'Способ оплаты не найден', 404);
    }
    await this.prisma.paymentMethod.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
