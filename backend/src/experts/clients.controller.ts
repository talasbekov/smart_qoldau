import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Expert } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from './expert.guard';
import { CurrentExpert } from './current-expert.decorator';
import { ExpertClientsService } from './clients.service';
import { ClientCardDto, ClientDetailDto } from './dto/client.dto';

// Р-27: психолог видит имя и историю встреч С НИМ. Ни телефона, ни
// клиентов других специалистов здесь нет и быть не может.
@ApiTags('experts')
@ApiBearerAuth()
@Controller('experts/me/clients')
@UseGuards(JwtAuthGuard, ExpertGuard)
export class ExpertClientsController {
  constructor(private clients: ExpertClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Клиенты эксперта, давшие согласие (Р-27)' })
  @ApiOkResponse({ type: [ClientCardDto] })
  async list(@CurrentExpert() expert: Expert): Promise<ClientCardDto[]> {
    return this.clients.list(expert.id);
  }

  @Get(':clientUserId')
  @ApiOperation({ summary: 'Карточка клиента: имя и история встреч (Р-27)' })
  @ApiOkResponse({ type: ClientDetailDto })
  @ApiNotFoundResponse({
    description:
      'CLIENT_NOT_FOUND — клиент не давал согласия, встреч после согласия не было, или это не ваш клиент',
  })
  async detail(
    @CurrentExpert() expert: Expert,
    @Param('clientUserId', ParseUUIDPipe) clientUserId: string,
  ): Promise<ClientDetailDto> {
    return this.clients.detail(expert.id, clientUserId);
  }
}
