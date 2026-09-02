import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { ContentService } from './content.service';
import { ContentItemDto } from './dto/content-item.dto';
import { ListContentDto } from './dto/list-content.dto';
import { SaveProgressDto, VoteDto } from './dto/save-progress.dto';
import { StreakDto, StreakService } from './streak.service';

// Контент доступен любому авторизованному пользователю, включая гостя
// (Р-22): библиотека самопомощи — это первое, ради чего человек может
// открыть приложение, ещё не оставив телефон.
@ApiTags('content')
@ApiBearerAuth()
// Guard'ы объявлены НА МЕТОДАХ, а не на классе: в Nest они складываются,
// и class-level JwtAuthGuard продолжал бы требовать токен даже там, где
// метод разрешает анонима.
@Controller('content')
export class ContentController {
  constructor(
    private content: ContentService,
    private streak: StreakService,
  ) {}

  // Объявлен ДО ':id', иначе 'streak' уедет в ParseUUIDPipe и станет 400.
  @UseGuards(JwtAuthGuard)
  @Get('streak')
  @ApiOkResponse({ description: 'Стрик практик и счётчик завершённых' })
  async streakOf(@CurrentUser() user: JwtPayload): Promise<StreakDto> {
    return this.streak.of(user.sub);
  }

  // Список и карточка открыты анониму: страницы материалов существуют
  // ради поиска, а поисковик приходит без токена. Пейволл от этого не
  // страдает — тело платного материала не отдаётся тому, у кого нет
  // подписки, а у анонима её нет по определению.
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ type: [ContentItemDto], description: 'Материалы' })
  async list(
    @Query() query: ListContentDto,
    @CurrentUser() user: JwtPayload | null,
  ): Promise<ContentItemDto[]> {
    return this.content.list(user?.sub ?? null, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/progress')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Прогресс сохранён' })
  @ApiNotFoundResponse({ description: 'CONTENT_NOT_FOUND' })
  async saveProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveProgressDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ positionPermille: number; completed: boolean }> {
    return this.content.saveProgress(user.sub, id, dto.positionPermille);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/vote')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Голос учтён' })
  @ApiNotFoundResponse({ description: 'CONTENT_NOT_FOUND' })
  async vote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ usefulYes: number; usefulNo: number }> {
    return this.content.vote(user.sub, id, dto.useful);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/media')
  @ApiOkResponse({ description: 'Подписанная ссылка на файл материала' })
  @ApiForbiddenResponse({ description: 'PREMIUM_REQUIRED' })
  @ApiNotFoundResponse({ description: 'CONTENT_NOT_FOUND' })
  async media(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ url: string; expiresAt: string }> {
    return this.content.media(user.sub, id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ type: ContentItemDto, description: 'Материал с телом' })
  @ApiNotFoundResponse({ description: 'CONTENT_NOT_FOUND' })
  async byId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload | null,
    @Query('locale') locale?: string,
  ): Promise<ContentItemDto> {
    return this.content.byId(user?.sub ?? null, id, locale);
  }
}
