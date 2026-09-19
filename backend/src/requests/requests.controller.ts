import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestDto } from './dto/request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/throttle/throttle.constants';
import { UserThrottlerGuard } from '../common/throttle/throttle.guards';

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private requestsService: RequestsService) {}

  @Post()
  // Каждая заявка тянет платные SMS экспертам, а кнопка «Попробовать снова»
  // позволяет крутить их без предела (см. THROTTLE.createRequest).
  // Порядок guard'ов важен: сначала JWT (иначе троттлер не увидит
  // пользователя и посчитает всех за одним NAT как одного), затем лимит.
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @Throttle({ default: THROTTLE.createRequest })
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать заявку на консультацию (БП-01)' })
  @ApiCreatedResponse({ description: 'Заявка создана', type: RequestDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiConflictResponse({
    description:
      'ACTIVE_REQUEST_EXISTS — у клиента уже есть активная заявка | EXPERT_UNAVAILABLE — выбранный эксперт недоступен',
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRequestDto,
  ): Promise<RequestDto> {
    return this.requestsService.create(user.sub, dto);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Последняя SEARCHING или MATCHED-заявка с ACTIVE-консультацией пользователя, иначе null',
  })
  @ApiOkResponse({ type: RequestDto })
  current(@CurrentUser() user: JwtPayload): Promise<RequestDto | null> {
    return this.requestsService.findCurrentForOwner(user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Статус своей заявки' })
  @ApiOkResponse({ description: 'Статус заявки', type: RequestDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'REQUEST_NOT_FOUND' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<RequestDto> {
    return this.requestsService.findForOwner(id, user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отменить свою заявку' })
  @ApiOkResponse({ description: 'Заявка отменена', type: RequestDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'REQUEST_NOT_FOUND' })
  @ApiConflictResponse({ description: 'REQUEST_ALREADY_CLOSED' })
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<RequestDto> {
    return this.requestsService.cancel(id, user.sub);
  }
}
