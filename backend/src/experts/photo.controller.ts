import {
  Controller,
  Delete,
  HttpCode,
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
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Expert } from '@prisma/client';
import { PhotoService } from './photo.service';
import { PhotoUploadedDto } from './dto/upload-photo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from './expert.guard';
import { CurrentExpert } from './current-expert.decorator';

// Тот же потолок, что MAX_BYTES в PhotoService.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

@ApiTags('experts')
@Controller('experts/me/photo')
@UseGuards(JwtAuthGuard, ExpertGuard)
@ApiBearerAuth()
export class PhotoController {
  constructor(private photo: PhotoService) {}

  @Post()
  @HttpCode(202)
  // Предел здесь дублирует проверку в PhotoService намеренно: сервис видит
  // файл, уже целиком лежащий в памяти, а multer обрывает поток на границе.
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
    }),
  )
  @ApiOperation({ summary: 'Загрузить фотографию профиля (на модерацию)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Фотография принята на проверку',
    type: PhotoUploadedDto,
  })
  @ApiBadRequestResponse({ description: 'PHOTO_INVALID' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  upload(
    @CurrentExpert() expert: Expert,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PhotoUploadedDto> {
    return this.photo.upload(expert, file);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Удалить фотографию профиля' })
  @ApiNoContentResponse({ description: 'Фотография удалена' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  remove(@CurrentExpert() expert: Expert): Promise<void> {
    return this.photo.remove(expert);
  }
}
