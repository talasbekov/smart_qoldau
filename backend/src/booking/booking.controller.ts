import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { BookingResultDto, CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('booking')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingController {
  constructor(private booking: BookingService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Записаться к специалисту на слот' })
  @ApiCreatedResponse({ description: 'Запись создана', type: BookingResultDto })
  @ApiResponse({
    status: 200,
    description: 'Такая запись уже есть — повторный запрос идемпотентен',
    type: BookingResultDto,
  })
  @ApiBadRequestResponse({
    description: 'SLOT_OUT_OF_RANGE | EXPERT_TOPIC_MISMATCH',
  })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND | TOPIC_NOT_FOUND' })
  @ApiConflictResponse({ description: 'SLOT_TAKEN | SLOT_UNAVAILABLE' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBookingDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BookingResultDto> {
    const { result, created } = await this.booking.create(user.sub, dto);
    // Повторный идентичный запрос — 200, а не 201: ничего нового не
    // создано, и клиент должен это различать.
    res.status(created ? 201 : 200);
    return result;
  }
}
