import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ListMessagesDto } from './dto/list-messages.dto';
import { MessageHistoryDto } from './dto/message-history.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('consultations')
@ApiBearerAuth()
@Controller('consultations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chat: ChatService) {}

  @Get(':id/messages')
  @ApiOperation({
    summary:
      'История сообщений чата консультации (участнику), расшифрованная, порядок createdAt asc',
  })
  @ApiOkResponse({ type: MessageHistoryDto })
  @ApiNotFoundResponse({ description: 'CONSULTATION_NOT_FOUND' })
  async messages(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() query: ListMessagesDto,
  ): Promise<MessageHistoryDto> {
    return this.chat.listHistory(id, user.sub, query.cursor, query.limit);
  }
}
