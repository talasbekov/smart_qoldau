import {
  Controller,
  Put,
  Delete,
  Get,
  Param,
  HttpCode,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { FavoritesService } from './favorites.service';
import { ExpertPublicDto } from '../experts/dto/expert-public.dto';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private favorites: FavoritesService) {}

  @Put(':expertId')
  @HttpCode(204)
  @ApiNoContentResponse({
    description: 'Эксперт добавлен в избранное (идемпотентно)',
  })
  async addToFavorites(
    @Param('expertId', new ParseUUIDPipe()) expertId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.favorites.addToFavorites(user.sub, expertId);
  }

  @Delete(':expertId')
  @HttpCode(204)
  @ApiNoContentResponse({
    description: 'Эксперт удалён из избранного (идемпотентно)',
  })
  async removeFromFavorites(
    @Param('expertId', new ParseUUIDPipe()) expertId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.favorites.removeFromFavorites(user.sub, expertId);
  }

  @Get()
  @ApiOkResponse({
    type: [ExpertPublicDto],
    description:
      'Список избранных экспертов (скрытые/заблокированные выпадают)',
  })
  async getFavorites(
    @CurrentUser() user: JwtPayload,
  ): Promise<ExpertPublicDto[]> {
    return this.favorites.getFavorites(user.sub);
  }
}
