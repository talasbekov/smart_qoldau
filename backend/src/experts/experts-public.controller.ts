import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ExpertsService } from './experts.service';
import { ListExpertsDto } from './dto/list-experts.dto';
import { ExpertPublicDto } from './dto/expert-public.dto';

// Публичные карточки экспертов — без авторизации, без PII.
// ВАЖНО: этот контроллер должен регистрироваться ПОСЛЕ ExpertsController в
// ExpertsModule, чтобы GET /v1/experts/me (ExpertsController) матчился
// раньше GET /v1/experts/:id (этот контроллер).
@ApiTags('experts')
@Controller('experts')
export class ExpertsPublicController {
  constructor(private expertsService: ExpertsService) {}

  @Get()
  @ApiOperation({
    summary: 'Публичный список экспертов (VERIFIED, не заблокированные)',
  })
  @ApiOkResponse({
    description: 'Список публичных карточек',
    type: [ExpertPublicDto],
  })
  async list(@Query() filters: ListExpertsDto): Promise<ExpertPublicDto[]> {
    return this.expertsService.listPublic(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Публичная карточка эксперта' })
  @ApiOkResponse({ description: 'Карточка эксперта', type: ExpertPublicDto })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ExpertPublicDto> {
    return this.expertsService.findPublicById(id);
  }
}
