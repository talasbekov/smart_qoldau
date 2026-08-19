import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TopicsService } from './topics.service';
import { ListTopicsDto } from './dto/list-topics.dto';
import { TopicDto } from './dto/topic.dto';

@ApiTags('topics')
@Controller('topics')
export class TopicsController {
  constructor(private topicsService: TopicsService) {}

  @Get()
  @ApiQuery({ name: 'locale', enum: ['ru', 'kz'], required: false })
  @ApiOkResponse({
    description: 'Список активных тем по sortOrder в выбранной локали',
    type: TopicDto,
    isArray: true,
  })
  list(@Query() query: ListTopicsDto) {
    const locale = query.locale ?? 'ru';
    return this.topicsService.list(locale);
  }
}
