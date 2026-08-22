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
