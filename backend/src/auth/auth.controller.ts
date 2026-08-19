import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RequestCodeDto } from './dto/request-code.dto';

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
}
