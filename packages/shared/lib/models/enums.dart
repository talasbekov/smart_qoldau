import 'package:freezed_annotation/freezed_annotation.dart';

/// Статус заявки на подбор эксперта (`RequestDto.status` бэкенда).
enum RequestStatus {
  @JsonValue('SEARCHING')
  searching,
  @JsonValue('MATCHED')
  matched,
  @JsonValue('CANCELLED')
  cancelled,
  @JsonValue('NO_EXPERTS')
  noExperts,
  @JsonValue('CALLBACK_REQUESTED')
  callbackRequested,
}

/// Статус консультации (`ConsultationClientDto.status` бэкенда).
enum ConsultationStatus {
  /// Плановая запись на слот (E6b): время выбрано, консультация ещё не
  /// началась.
  @JsonValue('SCHEDULED')
  scheduled,
  @JsonValue('ACTIVE')
  active,
  @JsonValue('COMPLETED')
  completed,
  @JsonValue('CANCELLED')
  cancelled,
}

/// Строковое представление [ConsultationStatus] для query-параметров, где
/// нет модели с собственным `toJson` (например, фильтр `GET /consultations`).
extension ConsultationStatusWire on ConsultationStatus {
  String get wireValue => switch (this) {
        ConsultationStatus.scheduled => 'SCHEDULED',
        ConsultationStatus.active => 'ACTIVE',
        ConsultationStatus.completed => 'COMPLETED',
        ConsultationStatus.cancelled => 'CANCELLED',
      };
}

/// Исход завершённой консультации (`ConsultationClientDto.outcome` бэкенда).
enum ConsultationOutcome {
  @JsonValue('COMPLETED')
  completed,
  @JsonValue('CLIENT_NO_SHOW')
  clientNoShow,
  @JsonValue('CLIENT_CANCELLED')
  clientCancelled,
  @JsonValue('TECH_ISSUE')
  techIssue,
  /// Отмена специалистом (E6b): клиенту полный возврат.
  @JsonValue('EXPERT_CANCELLED')
  expertCancelled,
}

/// Строковое представление [ConsultationOutcome] для мест, где значение
/// уходит не через модельный `toJson`, а напрямую в тело запроса (E7
/// задача 13: `POST /consultations/{id}/complete`).
extension ConsultationOutcomeWire on ConsultationOutcome {
  String get wireValue => switch (this) {
        ConsultationOutcome.completed => 'COMPLETED',
        ConsultationOutcome.clientNoShow => 'CLIENT_NO_SHOW',
        ConsultationOutcome.clientCancelled => 'CLIENT_CANCELLED',
        ConsultationOutcome.techIssue => 'TECH_ISSUE',
        ConsultationOutcome.expertCancelled => 'EXPERT_CANCELLED',
      };
}

/// Статус оплаты консультации (`ConsultationClientDto.paymentStatus`).
/// Отдельный от [PaymentStatus] enum — у бэкенда это разные Prisma-enum'ы
/// (здесь набор значений начинается с `UNPAID`, а не `PENDING`).
enum ConsultationPaymentStatus {
  @JsonValue('UNPAID')
  unpaid,
  @JsonValue('HELD')
  held,
  @JsonValue('CAPTURED')
  captured,
  @JsonValue('VOIDED')
  voided,
  @JsonValue('FAILED')
  failed,
}

/// Статус платежа (`PaymentStatusDto.status`, `PayResultDto.status`).
enum PaymentStatus {
  @JsonValue('PENDING')
  pending,
  @JsonValue('HELD')
  held,
  @JsonValue('CAPTURED')
  captured,
  @JsonValue('VOIDED')
  voided,
  @JsonValue('FAILED')
  failed,
}

/// Готовность эксперта принимать заявки (`ExpertPublicDto.workStatus`).
enum WorkStatus {
  @JsonValue('ACCEPTING')
  accepting,
  @JsonValue('BUSY')
  busy,
  @JsonValue('NOT_ACCEPTING')
  notAccepting,
  @JsonValue('UNAVAILABLE')
  unavailable,
}

/// Опыт работы эксперта (`ExpertPublicDto.experience`).
enum ExperienceLevel {
  @JsonValue('LESS_THAN_YEAR')
  lessThanYear,
  @JsonValue('ONE_TO_THREE')
  oneToThree,
  @JsonValue('THREE_TO_FIVE')
  threeToFive,
  @JsonValue('FIVE_TO_TEN')
  fiveToTen,
  @JsonValue('MORE_THAN_TEN')
  moreThanTen,
}

/// Формат консультации. У бэкенда это не Prisma-enum, а обычная строка,
/// провалидированная списком `['chat', 'audio', 'video']` (см.
/// `backend/src/requests/dto/create-request.dto.ts` и соседние DTO) — на
/// проводе значения строчные, не SCREAMING_SNAKE.
enum SessionFormat {
  @JsonValue('chat')
  chat,
  @JsonValue('audio')
  audio,
  @JsonValue('video')
  video,
}

/// Строковое представление [SessionFormat] для мест, где значение уходит не
/// через модельный `toJson`, а напрямую в query-параметр или тело запроса
/// (например, фильтр каталога или `MediaTokenRequestDto.format`).
extension SessionFormatWire on SessionFormat {
  String get wireValue => switch (this) {
        SessionFormat.chat => 'chat',
        SessionFormat.audio => 'audio',
        SessionFormat.video => 'video',
      };
}

/// Статус обращения в поддержку (`TicketStatus` Prisma-enum бэкенда, см.
/// `backend/prisma/schema.prisma`).
enum TicketStatus {
  @JsonValue('NEW')
  new_,
  @JsonValue('IN_PROGRESS')
  inProgress,
  @JsonValue('RESOLVED')
  resolved,
}

/// Категория обращения в поддержку (`TicketCategory` Prisma-enum бэкенда).
/// Допустимое подмножество зависит от типа автора (клиент/гость vs
/// эксперт) — это бэкенд проверяет сам при создании обращения
/// (`CATEGORIES_BY_AUTHOR` в `backend/src/tickets/ticket-routing.ts`),
/// модель тут просто перечисляет весь домен значений.
enum TicketCategory {
  @JsonValue('CONSULTATIONS')
  consultations,
  @JsonValue('PAYMENT')
  payment,
  @JsonValue('PAYOUTS')
  payouts,
  @JsonValue('TECHNICAL')
  technical,
  @JsonValue('VERIFICATION')
  verification,
  @JsonValue('SECURITY')
  security,
  @JsonValue('CLIENT_QUESTION')
  clientQuestion,
  @JsonValue('ACCOUNT_DATA')
  accountData,
  @JsonValue('OTHER')
  other,
}

/// Команда-исполнитель, которой маршрутизировано обращение (`TicketTeam`
/// Prisma-enum бэкенда).
enum TicketTeam {
  @JsonValue('SUPPORT_OPERATOR')
  supportOperator,
  @JsonValue('VERIFICATION_OPERATOR')
  verificationOperator,
  @JsonValue('FINANCE_CONTROL')
  financeControl,
  @JsonValue('QUALITY_TEAM')
  qualityTeam,
}

/// Автор одного сообщения переписки обращения (`TicketMessageDto.authorKind`
/// бэкенда). В отличие от `TicketStatus`/`TicketCategory`/`TicketTeam`, у
/// бэкенда это не настоящий Prisma-enum — колонка `ticket_messages.author_kind`
/// типа `String` с доменом `'user'|'staff'`, провалидированным только на
/// уровне DTO (`@ApiProperty({enum: ['user', 'staff']})`). Модели клиента
/// это не мешает — типобезопасный Dart-enum нужен независимо от того, как
/// домен закреплён на бэкенде.
enum TicketAuthorKind {
  @JsonValue('user')
  user,
  @JsonValue('staff')
  staff,
}

/// Статус верификации профиля эксперта (`ExpertMeDto.verificationStatus` бэкенда).
enum VerificationStatus {
  @JsonValue('DRAFT')
  draft,
  @JsonValue('PENDING')
  pending,
  @JsonValue('VERIFIED')
  verified,
}

/// Статус отдельного поля профиля эксперта (`ExpertMeDto.photoStatus`,
/// `ExpertMeDto.aboutStatus` бэкенда).
enum ProfileFieldStatus {
  @JsonValue('NONE')
  none,
  @JsonValue('PENDING')
  pending,
  @JsonValue('APPROVED')
  approved,
  @JsonValue('REJECTED')
  rejected,
}

/// Тип документа верификации эксперта (`DocumentType` Prisma-enum
/// бэкенда, см. `backend/prisma/schema.prisma`) — 4 обязательных типа,
/// весь набор нужен, чтобы отправить анкету на проверку.
enum DocumentType {
  @JsonValue('IDENTITY')
  identity,
  @JsonValue('DIPLOMA')
  diploma,
  @JsonValue('CERTIFICATES')
  certificates,
  @JsonValue('QUALIFICATION')
  qualification,
}

/// Статус загруженного документа верификации (`DocumentStatus` Prisma-enum
/// бэкенда).
enum DocumentStatus {
  @JsonValue('UPLOADED')
  uploaded,
  @JsonValue('APPROVED')
  approved,
  @JsonValue('REUPLOAD_REQUIRED')
  reuploadRequired,
}

/// Строковое представление [DocumentType] для подстановки в путь запроса
/// (`POST /experts/me/documents/{type}` ждёт SCREAMING_SNAKE, как и на
/// проводе JSON).
extension DocumentTypeWire on DocumentType {
  String get wireValue => switch (this) {
        DocumentType.identity => 'IDENTITY',
        DocumentType.diploma => 'DIPLOMA',
        DocumentType.certificates => 'CERTIFICATES',
        DocumentType.qualification => 'QUALIFICATION',
      };
}

/// Строковое представление [ExperienceLevel] для мест, где значение уходит не
/// через модельный `toJson`, а напрямую в тело запроса (для ручной сериализации).
extension ExperienceLevelWire on ExperienceLevel {
  String get wireValue => switch (this) {
        ExperienceLevel.lessThanYear => 'LESS_THAN_YEAR',
        ExperienceLevel.oneToThree => 'ONE_TO_THREE',
        ExperienceLevel.threeToFive => 'THREE_TO_FIVE',
        ExperienceLevel.fiveToTen => 'FIVE_TO_TEN',
        ExperienceLevel.moreThanTen => 'MORE_THAN_TEN',
      };
}

/// Строковое представление [WorkStatus] для мест, где значение уходит не
/// через модельный `toJson`, а напрямую в тело запроса (для ручной сериализации).
extension WorkStatusWire on WorkStatus {
  String get wireValue => switch (this) {
        WorkStatus.accepting => 'ACCEPTING',
        WorkStatus.busy => 'BUSY',
        WorkStatus.notAccepting => 'NOT_ACCEPTING',
        WorkStatus.unavailable => 'UNAVAILABLE',
      };
}
