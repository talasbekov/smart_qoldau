import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { DeviceDto } from './dto/device.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';

// Доступно любому авторизованному пользователю, включая гостя (пуш о
// найденном эксперте нужен и до конверсии) — ролевых ограничений нет.
@ApiTags('devices')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private devices: DevicesService) {}

  @Post('devices')
  @ApiOperation({ summary: 'Регистрация push-токена устройства (upsert)' })
  @ApiCreatedResponse({ type: DeviceDto })
  async register(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeviceDto> {
    const device = await this.devices.register(user.sub, dto);
    return {
      id: device.id,
      platform: device.platform,
      token: device.token,
      locale: device.locale,
    };
  }

  @Delete('devices/:token')
  @HttpCode(204)
  @ApiOperation({ summary: 'Удаление push-токена (logout устройства)' })
  @ApiParam({ name: 'token' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'DEVICE_NOT_FOUND' })
  async remove(
    @Param('token') token: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.devices.remove(user.sub, token);
  }

  @Patch('me/locale')
  @HttpCode(200)
  @ApiOperation({ summary: 'Локаль пользователя (ru|kz) — язык уведомлений' })
  @ApiOkResponse()
  async updateLocale(
    @Body() dto: UpdateLocaleDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.devices.updateLocale(user.sub, dto.locale);
  }
}
