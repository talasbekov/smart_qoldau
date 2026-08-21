import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsListDto } from './dto/notifications-list.dto';
import { ReadNotificationsDto } from './dto/read-notifications.dto';

// In-app центр уведомлений (§5.8) — доступен любому авторизованному,
// включая гостя.
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Центр уведомлений — свои, новые сверху + бейдж' })
  @ApiOkResponse({ type: NotificationsListDto })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListNotificationsDto,
  ): Promise<NotificationsListDto> {
    return this.notifications.list(user.sub, query);
  }

  @Post('read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Прочитать уведомления (без ids — все свои)' })
  @ApiOkResponse()
  async markRead(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReadNotificationsDto,
  ): Promise<void> {
    await this.notifications.markRead(user.sub, dto.ids);
  }

  @Post(':id/ack')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Подтверждение доставки пуша устройством (метрика §11.6)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse()
  @ApiNotFoundResponse({ description: 'NOTIFICATION_NOT_FOUND' })
  async ack(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.notifications.ack(user.sub, id);
  }
}
