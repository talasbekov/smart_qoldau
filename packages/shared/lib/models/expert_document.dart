import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'expert_document.freezed.dart';
part 'expert_document.g.dart';

/// Один документ верификации эксперта (`ExpertDocumentDto` бэкенда).
/// `status`/`updatedAt` — `null`, если документ этого типа ещё не
/// загружен (см. `DocumentsService.list` бэкенда: `{type, status: null}`
/// для отсутствующей записи).
@freezed
abstract class ExpertDocumentDto with _$ExpertDocumentDto {
  const factory ExpertDocumentDto({
    required DocumentType type,
    DocumentStatus? status,
    DateTime? updatedAt,
  }) = _ExpertDocumentDto;

  factory ExpertDocumentDto.fromJson(Map<String, dynamic> json) =>
      _$ExpertDocumentDtoFromJson(json);
}

/// Результат `POST /experts/me/documents/submit` (`SubmitVerificationDto`
/// бэкенда) — новый статус верификации анкеты (`PENDING` при успехе).
@freezed
abstract class SubmitVerificationDto with _$SubmitVerificationDto {
  const factory SubmitVerificationDto({
    required VerificationStatus verificationStatus,
  }) = _SubmitVerificationDto;

  factory SubmitVerificationDto.fromJson(Map<String, dynamic> json) =>
      _$SubmitVerificationDtoFromJson(json);
}
