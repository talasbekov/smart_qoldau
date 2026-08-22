import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/throttle/throttle.constants';
import { IpThrottlerGuard } from '../common/throttle/throttle.guards';
import {
  TicketCreatedDto,
  TicketDetailDto,
  TicketSummaryDto,
} from './dto/ticket.dto';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private tickets: TicketsService) {}

  @Post()
  // Эндпоинт неаутентифицированный и принимает 4200 символов: на него сядет
  // форма поддержки лендинга (см. THROTTLE.createTicket).
  @UseGuards(IpThrottlerGuard, OptionalJwtAuthGuard)
  @Throttle({ default: THROTTLE.createTicket })
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Создать обращение в поддержку. JWT необязателен: с токеном автор определяется сервером (эксперт/клиент), без токена — гость (обязателен contactEmail или contactPhone)',
  })
  @ApiCreatedResponse({ type: TicketCreatedDto })
  @ApiBadRequestResponse({
    description: 'TICKET_CONTACT_REQUIRED | TICKET_CATEGORY_NOT_ALLOWED',
  })
  async create(
    @CurrentUser() user: JwtPayload | null,
    @Body() dto: CreateTicketDto,
  ): Promise<TicketCreatedDto> {
    return this.tickets.create(dto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Мои обращения в поддержку' })
  @ApiOkResponse({ type: [TicketSummaryDto] })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListTicketsDto,
  ): Promise<TicketSummaryDto[]> {
    return this.tickets.list(user.sub, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Своё обращение с перепиской' })
  @ApiOkResponse({ type: TicketDetailDto })
  @ApiNotFoundResponse({ description: 'TICKET_NOT_FOUND' })
  async getOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TicketDetailDto> {
    return this.tickets.getOwn(user.sub, id);
  }
}
