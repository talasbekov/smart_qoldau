import { ApiProperty } from '@nestjs/swagger';
import {
  TicketAuthorType,
  TicketCategory,
  TicketStatus,
  TicketTeam,
} from '@prisma/client';

// Ответ на POST /v1/tickets. Сборка ТОЛЬКО явным перечислением полей —
// authorType/authorUserId/contactEmail/contactPhone автору не возвращаются
// здесь (он их и так знает/ввёл), они нужны только сотруднику поддержки
// (админ-API задачи 8).
export class TicketCreatedDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TicketStatus })
  status: TicketStatus;

  @ApiProperty({ enum: TicketCategory })
  category: TicketCategory;

  @ApiProperty({ enum: TicketTeam })
  team: TicketTeam;

  @ApiProperty()
  createdAt: Date;
}

// Строка списка GET /v1/tickets — без переписки (её отдаёт только detail).
export class TicketSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TicketCategory })
  category: TicketCategory;

  @ApiProperty()
  subject: string;

  @ApiProperty({ enum: TicketStatus })
  status: TicketStatus;

  @ApiProperty({ enum: TicketTeam })
  team: TicketTeam;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class TicketMessageDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['user', 'staff'] })
  authorKind: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  createdAt: Date;
}

// GET /v1/tickets/:id — своё обращение с полным текстом и перепиской
// (messages пуст, пока сотрудник/автор не ответили — задача 8).
export class TicketDetailDto extends TicketSummaryDto {
  @ApiProperty()
  body: string;

  @ApiProperty({ nullable: true, type: String })
  firstReplyAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  resolvedAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  relatedConsultationId: string | null;

  @ApiProperty({ nullable: true, type: String })
  relatedPayoutId: string | null;

  @ApiProperty({ type: [TicketMessageDto] })
  messages: TicketMessageDto[];
}

// GET /v1/admin/tickets/:id (задача 8) — та же карточка, что и у автора,
// плюс данные автора: сотруднику нужно знать, кто и как обратился (тип
// автора и контакт), автору эти поля о себе самом не возвращаются.
export class AdminTicketDetailDto extends TicketDetailDto {
  @ApiProperty({ enum: TicketAuthorType })
  authorType: TicketAuthorType;

  @ApiProperty({ nullable: true, type: String })
  authorUserId: string | null;

  @ApiProperty({ nullable: true, type: String })
  contactEmail: string | null;

  @ApiProperty({ nullable: true, type: String })
  contactPhone: string | null;
}
