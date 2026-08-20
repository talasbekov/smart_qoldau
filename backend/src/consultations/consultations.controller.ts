import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ConsultationsService } from './consultations.service';
import { ConsultationClientDto } from './dto/consultation-client.dto';
import { ConsultationExpertDto } from './dto/consultation-expert.dto';
import { ListConsultationsDto } from './dto/list-consultations.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('consultations')
@ApiBearerAuth()
@Controller('consultations')
@UseGuards(JwtAuthGuard)
@ApiExtraModels(ConsultationClientDto, ConsultationExpertDto)
export class ConsultationsController {
  constructor(private consultations: ConsultationsService) {}

  @Get(':id')
  @ApiOperation({
    summary:
      'Консультация участника — клиент видит ConsultationClientDto, эксперт ConsultationExpertDto',
  })
  @ApiOkResponse({
    description: 'Консультация (форма зависит от роли вызывающего)',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ConsultationClientDto) },
        { $ref: getSchemaPath(ConsultationExpertDto) },
      ],
    },
  })
  @ApiNotFoundResponse({ description: 'CONSULTATION_NOT_FOUND' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<ConsultationClientDto | ConsultationExpertDto> {
    return this.consultations.findForParticipant(id, user.sub);
  }

  @Get()
  @ApiOperation({
    summary:
      'Список своих консультаций (as=client|expert, default client), пагинация take/skip',
  })
  @ApiOkResponse({
    description: 'Список консультаций',
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(ConsultationClientDto) },
          { $ref: getSchemaPath(ConsultationExpertDto) },
        ],
      },
    },
  })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListConsultationsDto,
  ): Promise<(ConsultationClientDto | ConsultationExpertDto)[]> {
    return this.consultations.listForUser(user.sub, query);
  }
}
