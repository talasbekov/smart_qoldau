import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'expert_me.freezed.dart';
part 'expert_me.g.dart';

/// Профиль текущего эксперта (`ExpertMeDto` бэкенда).
@freezed
abstract class ExpertMe with _$ExpertMe {
  const factory ExpertMe({
    required String id,
    required String displayName,
    required String city,
    required ExperienceLevel experience,
    required String education,
    required int priceTiyn,
    required List<String> languages,
    required List<SessionFormat> formats,
    required List<String> topicSlugs,
    required VerificationStatus verificationStatus,
    required WorkStatus workStatus,
    required bool isBlocked,
    required bool acceptsUrgent,
    String? photoUrl,
    required ProfileFieldStatus photoStatus,
    String? about,
    required ProfileFieldStatus aboutStatus,
    String? moderationComment,
  }) = _ExpertMe;

  factory ExpertMe.fromJson(Map<String, dynamic> json) =>
      _$ExpertMeFromJson(json);
}

