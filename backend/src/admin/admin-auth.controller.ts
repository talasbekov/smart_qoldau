import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { AdminRefreshDto } from './dto/admin-refresh.dto';
import {
  TotpChallengeDto,
  TotpConfirmDto,
  TotpSetupResponseDto,
  TotpVerifyDto,
} from './dto/totp.dto';
import { AdminJwtGuard } from './admin-jwt.guard';
import { CurrentAdmin, CurrentAdminPayload } from './current-admin.decorator';

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
  // Ответ — ЛИБО пара токенов, ЛИБО требование второго фактора: у
  // сотрудника с включённой 2FA пары на этом шаге не существует.
  @ApiOkResponse({ type: TotpChallengeDto })
  login(
    @Body() dto: AdminLoginDto,
  ): Promise<AdminLoginResponseDto | TotpChallengeDto> {
    return this.adminAuth.login(dto.email, dto.password) as Promise<
      AdminLoginResponseDto | TotpChallengeDto
    >;
  }

  @Post('totp/setup')
  @HttpCode(200)
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Привязка второго фактора: секрет и коды восстановления отдаются РОВНО здесь и больше нигде',
  })
  @ApiOkResponse({ type: TotpSetupResponseDto })
  totpSetup(
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<TotpSetupResponseDto> {
    return this.adminAuth.totpSetup(admin.id);
  }

  @Post('totp/confirm')
  @HttpCode(204)
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Подтверждение привязки кодом из приложения — без него 2FA не включается',
  })
  totpConfirm(
    @CurrentAdmin() admin: CurrentAdminPayload,
    @Body() dto: TotpConfirmDto,
  ): Promise<void> {
    return this.adminAuth.totpConfirm(admin.id, dto.code);
  }

  @Post('totp/verify')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Второй шаг входа: код из приложения или одноразовый код восстановления',
  })
  @ApiOkResponse({ type: AdminLoginResponseDto })
  totpVerify(@Body() dto: TotpVerifyDto): Promise<AdminLoginResponseDto> {
    return this.adminAuth.totpVerify(dto.challengeToken, dto.code);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Продление сессии сотрудника. Токен ротируется: старый отзывается сразу',
  })
  @ApiOkResponse({ type: AdminLoginResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'ADMIN_INVALID_CREDENTIALS — токен неизвестен, отозван, истёк или сотрудник деактивирован',
  })
  refresh(@Body() dto: AdminRefreshDto): Promise<AdminLoginResponseDto> {
    return this.adminAuth.refresh(dto.refreshToken);
  }
}
