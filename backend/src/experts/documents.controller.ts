import {
  Controller,
  Get,
  HttpCode,
  MaxFileSizeValidator,
  Param,
  ParseEnumPipe,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DocumentType, Expert } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { ExpertDocumentDto, SubmitVerificationDto } from './dto/document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from './expert.guard';
import { CurrentExpert } from './current-expert.decorator';

@ApiTags('experts')
@Controller('experts/me/documents')
@UseGuards(JwtAuthGuard, ExpertGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  // Объявлен раньше ':type', иначе Nest матчит 'submit' как значение :type.
  @Post('submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Отправить анкету на проверку (Р-14)' })
  @ApiOkResponse({
    description: 'Анкета отправлена на проверку',
    type: SubmitVerificationDto,
  })
  @ApiBadRequestResponse({
    description: 'DOCUMENTS_INCOMPLETE | INVALID_STATE_TRANSITION',
  })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async submit(
    @CurrentExpert() expert: Expert,
  ): Promise<SubmitVerificationDto> {
    const result = await this.documentsService.submit(expert);
    return result as SubmitVerificationDto;
  }

  @Post(':type')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Загрузить документ эксперта (4 типа, MinIO)' })
  @ApiParam({ name: 'type', enum: DocumentType })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ description: 'Документ загружен', type: ExpertDocumentDto })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async upload(
    @CurrentExpert() expert: Expert,
    @Param('type', new ParseEnumPipe(DocumentType)) type: DocumentType,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /(pdf|jpe?g|png)$/,
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<ExpertDocumentDto> {
    return this.documentsService.upload(expert, type, file);
  }

  @Get()
  @ApiOperation({ summary: 'Список документов эксперта (4 позиции)' })
  @ApiOkResponse({
    description: 'Документы эксперта',
    type: ExpertDocumentDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async list(@CurrentExpert() expert: Expert): Promise<ExpertDocumentDto[]> {
    return this.documentsService.list(expert);
  }
}
