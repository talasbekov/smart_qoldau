import { ApiProperty } from '@nestjs/swagger';

// Ответ на операции с картой клиента. Собирается ТОЛЬКО явным перечислением
// полей (см. эталон ExpertPublicDto) — providerToken наружу не отдаём, PAN
// в БД не хранится вовсе.
export class PaymentMethodDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '**** 1111' })
  maskedPan: string;

  @ApiProperty({ example: 'visa' })
  brand: string;

  @ApiProperty({ example: 'Ivan Petrov' })
  holderName: string;
}
