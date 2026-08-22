import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'expert.freezed.dart';
part 'expert.g.dart';

/// Публичная карточка эксперта (`ExpertPublicDto` бэкенда).
///
/// Эталон PII-инварианта проекта: у бэкенда в этом DTO намеренно нет ни
/// телефона, ни документов, ни фото/«о себе» (см. комментарий в
/// `backend/src/experts/dto/expert-public.dto.ts`) — модель повторяет его
/// 1:1, ничего не добавляя "на будущее".
@freezed
abstract class ExpertPublic with _$ExpertPublic {
  const factory ExpertPublic({
    required String id,
    required String displayName,
    required String city,
    required ExperienceLevel experience,
    required int priceTiyn,
    required List<String> languages,
    required List<SessionFormat> formats,
    required List<String> topicSlugs,
    required WorkStatus workStatus,
    required double ratingAvg,
    required int ratingCount,
  }) = _ExpertPublic;

  factory ExpertPublic.fromJson(Map<String, dynamic> json) =>
      _$ExpertPublicFromJson(json);
}
