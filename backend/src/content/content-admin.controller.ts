import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  MaxFileSizeValidator,
  Param,
  ParseUUIDPipe,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
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
import { AudioFileValidator } from './audio-file.validator';
import { PatchContentDto, UpsertContentDto } from './dto/upsert-content.dto';

// Контентом занимается не тот же человек, что верифицирует специалистов и
// видит деньги: своя роль, а не «пусть публикует суперадмин».
const CONTENT_ROLES: AdminRole[] = [
  AdminRole.CONTENT_EDITOR,
  AdminRole.SUPERADMIN,
];

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

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

  @Post(':id/audio')
  @Roles(...CONTENT_ROLES)
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ description: 'MP3 загружен в приватное хранилище' })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED' })
  async uploadAudio(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_AUDIO_BYTES }),
          new AudioFileValidator(),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<ContentItem> {
    return this.content.uploadAudio(admin.id, id, file);
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
