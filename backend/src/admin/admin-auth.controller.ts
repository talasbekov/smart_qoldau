import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto, AdminLoginResponseDto } from './dto/admin-login.dto';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private adminAuth: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
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
