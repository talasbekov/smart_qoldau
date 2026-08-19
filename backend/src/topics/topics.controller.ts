import { Controller, Get, Query } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { ListTopicsDto } from './dto/list-topics.dto';

@Controller('topics')
export class TopicsController {
  constructor(private topicsService: TopicsService) {}

  @Get()
  list(@Query() query: ListTopicsDto) {
    const locale = query.locale ?? 'ru';
    return this.topicsService.list(locale);
  }
}
