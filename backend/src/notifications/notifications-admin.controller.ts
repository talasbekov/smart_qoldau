import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { RolesGuard } from '../admin/roles.guard';
import { PushObservationQueryDto } from './dto/push-observation-query.dto';
import { PushObservationDto } from './dto/push-observation.dto';
import { PushObservationService } from './push-observation.service';

@ApiTags('admin-notifications')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@Controller('admin/notifications')
export class NotificationsAdminController {
  constructor(private readonly observation: PushObservationService) {}

  @Get('push-observation')
  @ApiOperation({
    summary: 'Observe the bounded incoming-offer push cohort',
    description:
      'Local conveyor observation only; it does not establish provider acceptance or device delivery.',
  })
  @ApiOkResponse({ type: PushObservationDto })
  @ApiBadRequestResponse({ description: 'Invalid UTC observation window' })
  pushObservation(
    @Query() query: PushObservationQueryDto,
  ): Promise<PushObservationDto> {
    return this.observation.observe(query);
  }
}
