import 'package:freezed_annotation/freezed_annotation.dart';

part 'expert_note.freezed.dart';
part 'expert_note.g.dart';

/// Приватная заметка эксперта к консультации (`ExpertNoteDto` бэкенда).
///
/// `GET /consultations/{id}/note` отвечает 200 с `text: null`, когда
/// заметки ещё нет — это НЕ ошибка и НЕ 404 (404 там означает «не
/// участник», см. `NotesController`/`ConsultationsService.getExpertNote`).
@freezed
abstract class ExpertNoteDto with _$ExpertNoteDto {
  const factory ExpertNoteDto({String? text, DateTime? updatedAt}) =
      _ExpertNoteDto;

  factory ExpertNoteDto.fromJson(Map<String, dynamic> json) =>
      _$ExpertNoteDtoFromJson(json);
}
