import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import { OnlineCountQueryDto } from './dto/online-count-query.dto';
import { OnlineCountDto } from './dto/online-count.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('matching')
@ApiBearerAuth()
@Controller('matching')
@UseGuards(JwtAuthGuard)
export class MatchingController {
  constructor(private matching: MatchingService) {}

  @Get('online-count')
  @ApiOperation({
    summary:
      'Счётчик доступных сейчас экспертов для экрана поиска (ТЗ §5.3, БП-01)',
  })
  @ApiOkResponse({
    description: 'Число подходящих экспертов онлайн (без PII)',
    type: OnlineCountDto,
  })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  async onlineCount(
    @Query() query: OnlineCountQueryDto,
  ): Promise<OnlineCountDto> {
    // Неизвестный topicSlug не выделяется отдельной веткой: countCandidates
    // просто не находит совпадений по теме и отдаёт 0 — счётчик
    // информационный, поведение выровнено с фильтром каталога экспертов.
    //
    // Используется countCandidates, а не findCandidates: этому эндпоинту
    // нужна только длина списка, а findCandidates дополнительно считает
    // скоринг и сегодняшние офферы ради сортировки, которая здесь никому не
    // нужна — 2 лишних запроса к БД на каждого кандидата (см. комментарий
    // у countCandidates и matching-online-count-perf.e2e-spec.ts).
    const count = await this.matching.countCandidates({
      topicSlug: query.topicSlug,
      format: query.format,
      urgentOnly: query.urgentOnly,
    });
    return { count };
  }
}
