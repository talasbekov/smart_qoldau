/// Приватные заметки эксперта к консультации: тонкая обёртка над
/// `SqApiNotes` (E7 задача 13).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class ExpertNotesRepository {
  const ExpertNotesRepository(this._api);

  final SqApi _api;

  /// `GET /consultations/{id}/note` — заметка (`text: null`, если её ещё
  /// нет — это не ошибка).
  Future<ExpertNoteDto> note(String consultationId) => _api.note(consultationId);

  /// `PUT /consultations/{id}/note` — создать/обновить заметку.
  Future<ExpertNoteDto> saveNote(String consultationId, String text) =>
      _api.saveNote(consultationId, text);
}

final expertNotesRepositoryProvider = Provider<ExpertNotesRepository>(
  (ref) => ExpertNotesRepository(ref.watch(sqApiProvider)),
);
