import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole, ContentItem } from '@prisma/client';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { RolesGuard } from '../admin/roles.guard';
import { Roles } from '../admin/roles.decorator';
import {
  CurrentAdmin,
  CurrentAdminPayload,
} from '../admin/current-admin.decorator';
import { ContentAdminService } from './content-admin.service';
import { PatchContentDto, UpsertContentDto } from './dto/upsert-content.dto';

// Контентом занимается не тот же человек, что верифицирует специалистов и
// видит деньги: своя роль, а не «пусть публикует суперадмин».
const CONTENT_ROLES: AdminRole[] = [
  AdminRole.CONTENT_EDITOR,
  AdminRole.SUPERADMIN,
];

@ApiTags('admin-content')
@ApiBearerAuth()
@Controller('admin/content')
@UseGuards(AdminJwtGuard, RolesGuard)
export class ContentAdminController {
  constructor(private content: ContentAdminService) {}

  @Get()
  @Roles(...CONTENT_ROLES)
  @ApiOkResponse({ description: 'Материалы, включая черновики' })
  async list(): Promise<ContentItem[]> {
    return this.content.list();
  }

  @Post()
  @Roles(...CONTENT_ROLES)
  @ApiCreatedResponse({ description: 'Материал заведён' })
  @ApiConflictResponse({ description: 'CONTENT_SLUG_TAKEN' })
  async create(
    @Body() dto: UpsertContentDto,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<ContentItem> {
    return this.content.create(admin.id, dto);
  }

  @Patch(':id')
  @Roles(...CONTENT_ROLES)
  @ApiOkResponse({ description: 'Материал обновлён' })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchContentDto,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<ContentItem> {
    return this.content.patch(admin.id, id, dto);
  }

  @Delete(':id')
  @Roles(...CONTENT_ROLES)
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Материал удалён' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<void> {
    await this.content.remove(admin.id, id);
  }
}
