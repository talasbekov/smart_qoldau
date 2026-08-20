import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ConsultationsService } from './consultations.service';
import { ExpertNoteDto } from './dto/expert-note.dto';
import { UpdateExpertNoteDto } from './dto/update-expert-note.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('consultations')
@ApiBearerAuth()
@Controller('consultations')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private consultations: ConsultationsService) {}

  @Get(':id/note')
  @ApiOperation({
    summary: 'Приватная заметка эксперта к консультации',
    description:
      'Приватные заметки специалиста. Не используйте медицинские диагнозы.',
  })
  @ApiOkResponse({
    type: ExpertNoteDto,
    description:
      'Заметка (text: null если заметки нет). Только для эксперта-участника.',
  })
  @ApiNotFoundResponse({
    description:
      'CONSULTATION_NOT_FOUND — клиент или чужой эксперт (заметка приватна)',
  })
  async getNote(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<ExpertNoteDto> {
    return this.consultations.getExpertNote(id, user.sub);
  }

  @Put(':id/note')
  @ApiOperation({
    summary: 'Создать или обновить приватную заметку эксперта',
    description:
      'Приватные заметки специалиста. Не используйте медицинские диагнозы.',
  })
  @ApiOkResponse({
    type: ExpertNoteDto,
    description: 'Созданная/обновлённая заметка',
  })
  @ApiNotFoundResponse({
    description:
      'CONSULTATION_NOT_FOUND — клиент или чужой эксперт (заметка приватна)',
  })
  @ApiBadRequestResponse({
    description: 'Текст не может быть пустым или >5000 символов',
  })
  async updateNote(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateExpertNoteDto,
  ): Promise<ExpertNoteDto> {
    return this.consultations.updateExpertNote(id, user.sub, dto.text);
  }
}
