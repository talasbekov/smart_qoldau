import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Expert } from '@prisma/client';
import { ExpertsService } from './experts.service';
import { CreateExpertDto } from './dto/create-expert.dto';
import { UpdateExpertDto } from './dto/update-expert.dto';
import { ExpertMeDto } from './dto/expert-me.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { ExpertGuard } from './expert.guard';

const CurrentExpert = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Expert => {
    const request = ctx.switchToHttp().getRequest();
    return request.expert as Expert;
  },
);

@ApiTags('experts')
@Controller('experts')
export class ExpertsController {
  constructor(private expertsService: ExpertsService) {}

  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать анкету эксперта (Р-04)' })
  @ApiOkResponse({ description: 'Анкета создана', type: ExpertMeDto })
  @ApiBadRequestResponse({
    description: 'VALIDATION_FAILED | PRICE_OUT_OF_RANGE',
  })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiForbiddenResponse({
    description: 'FORBIDDEN — гостевой аккаунт не может создать анкету',
  })
  @ApiConflictResponse({ description: 'EXPERT_EXISTS — анкета уже создана' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateExpertDto,
  ): Promise<ExpertMeDto> {
    const expert = await this.expertsService.create(
      user.sub,
      user.isGuest,
      dto,
    );
    return this.expertsService.toMeDto(expert);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить свою анкету эксперта' })
  @ApiOkResponse({ description: 'Анкета эксперта', type: ExpertMeDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async me(@CurrentExpert() expert: Expert): Promise<ExpertMeDto> {
    const withTopics = await this.expertsService.findByUserId(expert.userId);
    return this.expertsService.toMeDto(withTopics!);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, ExpertGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить свою анкету эксперта (Р-18)' })
  @ApiOkResponse({ description: 'Анкета обновлена', type: ExpertMeDto })
  @ApiBadRequestResponse({
    description: 'VALIDATION_FAILED | PRICE_OUT_OF_RANGE',
  })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async update(
    @CurrentExpert() expert: Expert,
    @Body() dto: UpdateExpertDto,
  ): Promise<ExpertMeDto> {
    const updated = await this.expertsService.update(expert, dto);
    return this.expertsService.toMeDto(updated);
  }
}
