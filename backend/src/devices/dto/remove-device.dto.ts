import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

// Токен передаётся ТЕЛОМ, а не путём URL (E11a, задача 9): путь попадает в
// access-логи nginx, трейсы APM и историю прокси, а в паре с перепривязкой
// токена при регистрации это даёт угон пушей — глушение критичного
// offer.incoming у жертвы.
export class RemoveDeviceDto {
  @ApiProperty({ description: 'Push-токен устройства' })
  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  token: string;
}
