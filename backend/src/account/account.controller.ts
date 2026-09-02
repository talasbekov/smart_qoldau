import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { AccountService } from './account.service';
import {
  AcceptExpertVisibilityDto,
  ProfileDto,
} from './dto/expert-visibility.dto';
import { ApiOkResponse } from '@nestjs/swagger';

@ApiTags('account')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private account: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Свой профиль: имя и отметка согласия (Р-27)' })
  @ApiOkResponse({ type: ProfileDto })
  async profile(@CurrentUser() user: JwtPayload): Promise<ProfileDto> {
    return this.account.profile(user.sub);
  }

  // Р-27. Согласие и имя принимаются вместе: двумя шагами в этом месте
  // человек с большей вероятностью передумает, а без имени согласие
  // бессмысленно — психологу нечего будет показать.
  @Post('expert-visibility')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Согласиться, что психолог видит имя и историю встреч, и назвать имя (Р-27)',
  })
  @ApiOkResponse({ type: ProfileDto })
  async acceptExpertVisibility(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AcceptExpertVisibilityDto,
  ): Promise<ProfileDto> {
    return this.account.acceptExpertVisibility(user.sub, dto.displayName);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Удалить свой аккаунт и данные (ТЗ §5.1). Консультации, платежи и ' +
      'проводки остаются как учётные записи, PII из аккаунта вычищается.',
  })
  @ApiNoContentResponse({ description: 'Аккаунт удалён' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — аккаунт уже удалён' })
  @ApiConflictResponse({
    description:
      'EXPERT_DELETE_VIA_SUPPORT | CONSULTATION_IN_PROGRESS | PAYMENT_IN_PROGRESS',
  })
  async remove(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.account.deleteOwn(user.sub);
  }
}
