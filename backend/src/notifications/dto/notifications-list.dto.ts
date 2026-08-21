import { ApiProperty } from '@nestjs/swagger';
import { NotificationDto } from './notification.dto';

export class NotificationsListDto {
  @ApiProperty({ type: [NotificationDto] })
  items: NotificationDto[];

  @ApiProperty({ description: 'Всего непрочитанных (независимо от страницы)' })
  unreadCount: number;
}
