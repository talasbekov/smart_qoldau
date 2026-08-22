import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { AdminLoginResponseDto } from './admin-login.dto';

export class AdminRefreshDto {
  @ApiProperty({ description: 'Refresh-токен, выданный при входе' })
  @IsString()
  @MinLength(32)
  refreshToken: string;
}

// Ответ тот же, что у входа: пара токенов + сотрудник. Отдельный класс —
// чтобы Swagger показывал его как самостоятельную схему ответа refresh.
export class AdminSessionDto extends AdminLoginResponseDto {}
