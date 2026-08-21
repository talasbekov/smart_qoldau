import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from './admin-jwt.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { CurrentAdmin, CurrentAdminPayload } from './current-admin.decorator';
import { AdminStaffService } from './admin-staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import {
  ListStaffDto,
  StaffCardDto,
  StaffDto,
  StaffListDto,
} from './dto/staff.dto';

@ApiTags('admin-staff')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@ApiForbiddenResponse({
  description: 'ADMIN_FORBIDDEN — требуется роль SUPERADMIN',
})
@Controller('admin/staff')
export class AdminStaffController {
  constructor(private staff: AdminStaffService) {}

  @Post()
  @Roles(AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Создать сотрудника админки (SUPERADMIN)' })
  @ApiCreatedResponse({ type: StaffDto })
  @ApiConflictResponse({ description: 'STAFF_EMAIL_EXISTS' })
  async create(
    @Body() dto: CreateStaffDto,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<StaffDto> {
    return this.staff.create(dto, admin.id);
  }

  @Get()
  @Roles(AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Список сотрудников админки (SUPERADMIN)' })
  @ApiOkResponse({ type: StaffListDto })
  async list(@Query() query: ListStaffDto): Promise<StaffListDto> {
    return this.staff.list({ take: query.take, skip: query.skip });
  }

  @Patch(':id')
  @Roles(AdminRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Изменить роли и/или активность сотрудника (SUPERADMIN)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StaffCardDto })
  @ApiNotFoundResponse({ description: 'STAFF_NOT_FOUND' })
  @ApiBadRequestResponse({
    description:
      'STAFF_SELF_LOCKOUT_FORBIDDEN — нельзя деактивировать себя или снять с себя роль SUPERADMIN',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<StaffCardDto> {
    return this.staff.update(id, dto, admin);
  }
}
