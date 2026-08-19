import {
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
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Expert } from '@prisma/client';
import { RequestsService } from './requests.service';
import { OfferDto } from './dto/offer.dto';
import { AcceptOfferDto } from './dto/accept-offer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from '../experts/expert.guard';
import { CurrentExpert } from '../experts/current-expert.decorator';

@ApiTags('offers')
@Controller()
export class OffersController {
  constructor(private requestsService: RequestsService) {}

  @Get('experts/me/offers')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Активные PENDING-офферы эксперта (без PII клиента)',
  })
  @ApiOkResponse({
    description: 'Список офферов',
    type: OfferDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async myOffers(@CurrentExpert() expert: Expert): Promise<OfferDto[]> {
    return this.requestsService.listOffersForExpert(expert.id);
  }

  @Post('offers/:offerId/accept')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, ExpertGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Принять оффер (атомарно)' })
  @ApiOkResponse({ description: 'Заявка сматчена', type: AcceptOfferDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'OFFER_NOT_FOUND' })
  @ApiGoneResponse({ description: 'OFFER_EXPIRED — истёк дедлайн' })
  @ApiConflictResponse({ description: 'OFFER_ALREADY_TAKEN' })
  async accept(
    @CurrentExpert() expert: Expert,
    @Param('offerId') offerId: string,
  ): Promise<AcceptOfferDto> {
    return this.requestsService.acceptOffer(offerId, expert.id);
  }

  @Post('offers/:offerId/decline')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, ExpertGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Отклонить оффер — заявка уходит следующему кандидату',
  })
  @ApiOkResponse({ description: 'Оффер отклонён' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'OFFER_NOT_FOUND' })
  @ApiGoneResponse({ description: 'OFFER_EXPIRED — истёк дедлайн' })
  @ApiConflictResponse({ description: 'OFFER_ALREADY_TAKEN' })
  async decline(
    @CurrentExpert() expert: Expert,
    @Param('offerId') offerId: string,
  ): Promise<void> {
    await this.requestsService.declineOffer(offerId, expert.id);
  }
}
