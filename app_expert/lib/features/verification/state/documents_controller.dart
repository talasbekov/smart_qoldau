/// Состояние и контроллер экрана документов верификации (E7 задача 5).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/documents_repository.dart';

/// Загруженные документы, разложенные по типу — `Map`, а не `List`,
/// специально: у карты нет способа хранить два значения на один
/// `DocumentType`, поэтому повторная загрузка того же типа замещает
/// запись сама по себе (см. [upload]), без отдельной логики де-дупликации.
class DocumentsController
    extends AsyncNotifier<Map<DocumentType, ExpertDocumentDto>> {
  @override
  FutureOr<Map<DocumentType, ExpertDocumentDto>> build() => _load();

  DocumentsRepository get _repo => ref.read(documentsRepositoryProvider);

  Future<Map<DocumentType, ExpertDocumentDto>> _load() async {
    final list = await _repo.documents();
    return {for (final doc in list) doc.type: doc};
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(_load);
  }

  /// `true`, только когда все 4 [DocumentType] присутствуют в состоянии со
  /// статусом, отличным от `null` — считать по одному лишь размеру карты
  /// было бы неверно: карта всегда содержит все 4 ключа (см. [_load]),
  /// различие в том, загружен ли документ (`status != null`) или нет.
  bool get canSubmit {
    final docs = state.valueOrNull;
    if (docs == null) return false;
    return DocumentType.values.every((type) => docs[type]?.status != null);
  }

  /// Загружает документ [type] и заменяет его запись в состоянии — не
  /// добавляет вторую (см. класс-документацию).
  Future<void> upload(
    DocumentType type, {
    required List<int> bytes,
    required String filename,
  }) async {
    final uploaded = await _repo.upload(type, bytes: bytes, filename: filename);
    final current = state.valueOrNull ?? const {};
    state = AsyncData({...current, type: uploaded});
  }

  /// `POST /experts/me/documents/submit` — вызывается, только если
  /// [canSubmit]; иначе — no-op (кнопка в UI и так задизейблена, но
  /// контроллер не полагается на это и не шлёт лишний запрос).
  Future<void> submit() async {
    if (!canSubmit) return;
    await _repo.submit();
  }
}

final documentsControllerProvider =
    AsyncNotifierProvider<DocumentsController, Map<DocumentType, ExpertDocumentDto>>(
  DocumentsController.new,
);
