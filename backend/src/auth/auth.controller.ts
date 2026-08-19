import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RequestCodeDto } from './dto/request-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { RefreshDto } from './dto/refresh.dto';
import { TokensDto } from './dto/tokens.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('request-code')
  @HttpCode(204)
  @ApiOperation({ summary: 'Запросить SMS-код входа' })
  @ApiNoContentResponse({
    description: 'Код отправлен (или залогирован в dev-режиме)',
  })
  @ApiBadRequestResponse({
    description: 'VALIDATION_FAILED — номер не в формате +77XXXXXXXXX',
  })
  @ApiTooManyRequestsResponse({
    description: 'SMS_RATE_LIMITED — повтор раньше 45 секунд',
  })
  requestCode(@Body() dto: RequestCodeDto): Promise<void> {
    return this.authService.requestCode(dto.phone);
  }

  @Post('verify-code')
  @HttpCode(200)
  @ApiOperation({ summary: 'Подтвердить SMS-код и получить токены' })
  @ApiOkResponse({
    description: 'Пара токенов + пользователь',
    type: TokensDto,
  })
  @ApiBadRequestResponse({
    description: 'SMS_CODE_EXPIRED | SMS_CODE_INVALID | VALIDATION_FAILED',
  })
  async verifyCode(@Body() dto: VerifyCodeDto): Promise<TokensDto> {
    const { accessToken, refreshToken, user } =
      await this.authService.verifyCode(dto.phone, dto.code);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, phone: user.phone, isGuest: user.isGuest },
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Обновить пару токенов по refresh-токену' })
  @ApiOkResponse({
    description: 'Новая пара токенов + пользователь',
    type: TokensDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'UNAUTHORIZED — refresh-токен недействителен, отозван или истёк',
  })
  async refresh(@Body() dto: RefreshDto): Promise<TokensDto> {
    const { accessToken, refreshToken, user } = await this.authService.refresh(
      dto.refreshToken,
    );
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, phone: user.phone, isGuest: user.isGuest },
    };
  }
}
