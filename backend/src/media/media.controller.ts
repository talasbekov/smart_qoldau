import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { MediaTokenRequestDto } from './dto/media-token-request.dto';
import { MediaTokenResponseDto } from './dto/media-token-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('consultations')
@ApiBearerAuth()
@Controller('consultations')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private media: MediaService) {}

  @Post(':id/media-token')
  @ApiOperation({
    summary:
      'LiveKit-токен для участника ACTIVE-консультации; эскалация формата chat->audio->video (понижение запрещено)',
  })
  @ApiOkResponse({ type: MediaTokenResponseDto })
  @ApiNotFoundResponse({ description: 'CONSULTATION_NOT_FOUND' })
  async mediaToken(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: MediaTokenRequestDto,
  ): Promise<MediaTokenResponseDto> {
    return this.media.requestMediaToken(id, user.sub, body.format);
  }
}
