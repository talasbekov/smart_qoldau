import {
  Controller,
  Get,
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
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { ContentService } from './content.service';
import { ContentItemDto } from './dto/content-item.dto';
import { ListContentDto } from './dto/list-content.dto';

// Контент доступен любому авторизованному пользователю, включая гостя
// (Р-22): библиотека самопомощи — это первое, ради чего человек может
// открыть приложение, ещё не оставив телефон.
@ApiTags('content')
@ApiBearerAuth()
@Controller('content')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private content: ContentService) {}

  @Get()
  @ApiOkResponse({ type: [ContentItemDto], description: 'Материалы' })
  async list(
    @Query() query: ListContentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ContentItemDto[]> {
    return this.content.list(user.sub, query);
  }

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
  @ApiOkResponse({ type: ContentItemDto, description: 'Материал с телом' })
  @ApiNotFoundResponse({ description: 'CONTENT_NOT_FOUND' })
  async byId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ContentItemDto> {
    return this.content.byId(user.sub, id);
  }
}
