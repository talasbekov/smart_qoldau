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
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { RolesGuard } from '../admin/roles.guard';
import { Roles } from '../admin/roles.decorator';
import {
  CurrentAdmin,
  CurrentAdminPayload,
} from '../admin/current-admin.decorator';
import { TicketsService } from './tickets.service';
import { AdminListTicketsDto } from './dto/admin-list-tickets.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { AdminTicketDetailDto, AdminTicketsListDto } from './dto/ticket.dto';

// Роли, открывающие доступ к очереди тикетов сотрудника (задача 8) —
// профильные команды, на которые маршрутизируются тикеты (ticket-routing.ts).
// SUPERADMIN дополнительно пропускается самим RolesGuard без явного
// перечисления здесь (см. roles.guard.ts).
const TICKET_TEAM_ROLES = [
  AdminRole.SUPPORT_OPERATOR,
  AdminRole.VERIFICATION_OPERATOR,
  AdminRole.FINANCE_CONTROL,
  AdminRole.QUALITY_TEAM,
];

@ApiTags('admin-tickets')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@Controller('admin/tickets')
export class TicketsAdminController {
  constructor(private tickets: TicketsService) {}

  @Get()
  @Roles(...TICKET_TEAM_ROLES)
  @ApiOperation({
    summary:
      'Очередь тикетов своих команд (SUPERADMIN — все команды без ограничения)',
  })
  @ApiOkResponse({ type: AdminTicketsListDto })
  async list(
    @CurrentAdmin() admin: CurrentAdminPayload,
    @Query() query: AdminListTicketsDto,
  ): Promise<AdminTicketsListDto> {
    return this.tickets.adminList(admin, query);
  }

  @Get(':id')
  @Roles(...TICKET_TEAM_ROLES)
  @ApiOperation({
    summary: 'Карточка тикета с перепиской и данными автора',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AdminTicketDetailDto })
  @ApiNotFoundResponse({ description: 'TICKET_NOT_FOUND' })
  async getOne(
    @CurrentAdmin() admin: CurrentAdminPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminTicketDetailDto> {
    return this.tickets.adminGet(admin, id);
  }

  @Post(':id/reply')
  @Roles(...TICKET_TEAM_ROLES)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Ответ сотрудника: первый ответ проставляет firstReplyAt и переводит NEW -> IN_PROGRESS (идемпотентно)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Ответ сохранён, тело ответа пустое' })
  @ApiNotFoundResponse({ description: 'TICKET_NOT_FOUND' })
  @ApiConflictResponse({ description: 'TICKET_ALREADY_RESOLVED' })
  async reply(
    @CurrentAdmin() admin: CurrentAdminPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyTicketDto,
  ): Promise<void> {
    await this.tickets.reply(admin, id, dto.body);
  }

  @Post(':id/resolve')
  @Roles(...TICKET_TEAM_ROLES)
  @HttpCode(200)
  @ApiOperation({ summary: 'Решить тикет -> RESOLVED' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Тикет решён, тело ответа пустое' })
  @ApiNotFoundResponse({ description: 'TICKET_NOT_FOUND' })
  @ApiConflictResponse({ description: 'TICKET_ALREADY_RESOLVED' })
  async resolve(
    @CurrentAdmin() admin: CurrentAdminPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.tickets.resolve(admin, id);
  }
}
