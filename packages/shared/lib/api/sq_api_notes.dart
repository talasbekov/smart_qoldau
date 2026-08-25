import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Приватные заметки эксперта к консультации (E7 задача 13).
mixin SqApiNotes on SqApiBase {
  /// `GET /consultations/{id}/note` — заметка эксперта. Отвечает 200 с
  /// `text: null`, когда заметки ещё нет (см. `ExpertNoteDto`) — это НЕ
  /// повод бросать `ApiException`.
  Future<ExpertNoteDto> note(String consultationId) => guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.consultationNote(consultationId),
        );
        return ExpertNoteDto.fromJson(response.data!);
      });

  /// `PUT /consultations/{id}/note` — создать/обновить заметку.
  /// `400 INVALID_NOTE_TEXT` — пусто или длиннее 5000 символов.
  Future<ExpertNoteDto> saveNote(String consultationId, String text) =>
      guard(() async {
        final response = await dio.put<Map<String, dynamic>>(
          SqEndpoints.consultationNote(consultationId),
          data: {'text': text},
        );
        return ExpertNoteDto.fromJson(response.data!);
      });
}
