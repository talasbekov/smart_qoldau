import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';
import 'expert.dart';

part 'match_request.freezed.dart';
part 'match_request.g.dart';

/// Заявка на подбор эксперта (`RequestDto` бэкенда).
///
/// [matchedExpert] и [consultationId] появляются только при `status ==
/// matched`, [hotlines] — только при `status == callbackRequested`.
///
/// Бэкенд строит этот DTO не сплошным литералом, а условно — `dto.x = ...`
/// только внутри `if` (см. `RequestsService.toRequestDto`) — поэтому
/// отсутствующие поля не приходят как `null`, их вообще нет в JSON.
/// `includeIfNull: false` воспроизводит это же на выходе.
@freezed
abstract class MatchRequest with _$MatchRequest {
  const factory MatchRequest({
    required String id,
    required RequestStatus status,
    required bool isEmergency,
    required int clientCode,
    @JsonKey(includeIfNull: false) ExpertPublic? matchedExpert,
    @JsonKey(includeIfNull: false) String? consultationId,
    @JsonKey(includeIfNull: false) List<String>? hotlines,
  }) = _MatchRequest;

  factory MatchRequest.fromJson(Map<String, dynamic> json) =>
      _$MatchRequestFromJson(json);
}
