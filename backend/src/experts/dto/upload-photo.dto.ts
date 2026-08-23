import { ApiProperty } from '@nestjs/swagger';
import { ProfileFieldStatus } from '@prisma/client';

// Ответ на загрузку фотографии: фото принято на проверку, а не
// опубликовано — публикация только после решения оператора.
export class PhotoUploadedDto {
  @ApiProperty({
    enum: ProfileFieldStatus,
    example: ProfileFieldStatus.PENDING,
  })
  status: ProfileFieldStatus;
}
