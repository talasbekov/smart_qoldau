import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TotpSetupResponseDto {
  @ApiProperty({
    description:
      'Секрет для приложения-аутентификатора. Единственный момент, когда он покидает сервер',
  })
  secret: string;

  @ApiProperty({ description: 'otpauth://-ссылка для QR-кода' })
  otpauthUrl: string;

  @ApiProperty({
    isArray: true,
    type: String,
    description:
      'Одноразовые коды восстановления. Показываются один раз — дальше в базе только их хеши',
  })
  recoveryCodes: string[];
}

export class TotpConfirmDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class TotpVerifyDto {
  @ApiProperty({ description: 'challengeToken из ответа на вход' })
  @IsString()
  challengeToken: string;

  @ApiProperty({
    example: '123456',
    description:
      'Код из приложения (6 цифр) или код восстановления (32 hex-символа)',
  })
  @IsString()
  @Length(6, 64)
  code: string;
}

export class TotpChallengeDto {
  @ApiProperty({ example: true })
  totpRequired: true;

  @ApiProperty({
    description:
      'Короткоживущий токен второго шага. Ни один рабочий эндпоинт им не открывается',
  })
  challengeToken: string;
}
