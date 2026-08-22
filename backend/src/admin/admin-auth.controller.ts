import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/throttle/throttle.constants';
import { AdminLoginThrottlerGuard } from '../common/throttle/throttle.guards';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto, AdminLoginResponseDto } from './dto/admin-login.dto';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private adminAuth: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  // Перебор пароля — самая дешёвая атака на админку: лимит по email
  // (см. THROTTLE.adminLogin).
  @UseGuards(AdminLoginThrottlerGuard)
  @Throttle({ default: THROTTLE.adminLogin })
  @ApiOperation({ summary: 'Вход сотрудника админки по email и паролю' })
  @ApiOkResponse({
    description: 'accessToken + сотрудник (id, email, roles)',
    type: AdminLoginResponseDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'ADMIN_INVALID_CREDENTIALS — неверный email, пароль или заблокированный сотрудник (ответ неразличим)',
  })
  login(@Body() dto: AdminLoginDto): Promise<AdminLoginResponseDto> {
    return this.adminAuth.login(dto.email, dto.password);
  }
}
