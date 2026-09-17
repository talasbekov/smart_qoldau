import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { Roles } from '../admin/roles.decorator';
import { RolesGuard } from '../admin/roles.guard';
import { ConsultationNoShowObservationService } from './consultation-no-show-observation.service';
import { ConsultationNoShowObservationQueryDto } from './dto/consultation-no-show-observation-query.dto';
import { ConsultationNoShowObservationDto } from './dto/consultation-no-show-observation.dto';

@ApiTags('admin-consultations')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@ApiForbiddenResponse({ description: 'ADMIN_FORBIDDEN' })
@Controller('admin/consultations')
export class ConsultationsAdminController {
  constructor(
    private readonly noShowObservation: ConsultationNoShowObservationService,
  ) {}

  @Get('no-show-observation')
  @Roles(AdminRole.QUALITY_TEAM)
  @ApiOperation({
    summary: 'Observe confirmed client no-show outcome counts',
    description:
      'Raw counts only: this source defines no no-show rate, denominator, business threshold, penalty, or alert. The technical cohort is COMPLETED with endedAt in [from,to); a late-recorded outcome is bucketed by its recorded endedAt, and the statement snapshot is not a causal as-of view. The 24-hour request bound does not bound the separate all-time missing-endedAt scan or guarantee a bounded row count.',
  })
  @ApiOkResponse({ type: ConsultationNoShowObservationDto })
  @ApiBadRequestResponse({ description: 'Invalid UTC observation window' })
  @ApiInternalServerErrorResponse({
    description: 'Database or aggregate validation failure',
  })
  noShowObservationResult(
    @Query() query: ConsultationNoShowObservationQueryDto,
  ): Promise<ConsultationNoShowObservationDto> {
    return this.noShowObservation.observe(query);
  }
}
