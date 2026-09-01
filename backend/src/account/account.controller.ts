import { Controller, Delete, HttpCode, UseGuards } from '@nestjs/common';
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

@ApiTags('account')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private account: AccountService) {}

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
