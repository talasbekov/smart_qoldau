/// Документы верификации эксперта: тонкая обёртка над `SqApiDocuments`.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class DocumentsRepository {
  const DocumentsRepository(this._api);

  final SqApi _api;

  /// `GET /experts/me/documents` — все 4 позиции (`status: null` для ещё
  /// не загруженного типа).
  Future<List<ExpertDocumentDto>> documents() => _api.documents();

  /// `POST /experts/me/documents/{type}` — multipart-загрузка. Бросает
  /// `DocumentTooLargeException` до сети, если [bytes] превышает
  /// `documentMaxSizeBytes`.
  Future<ExpertDocumentDto> upload(
    DocumentType type, {
    required List<int> bytes,
    required String filename,
  }) => _api.uploadDocument(type, bytes: bytes, filename: filename);

  /// `POST /experts/me/documents/submit` — отправить анкету на проверку.
  Future<SubmitVerificationDto> submit() => _api.submitForVerification();
}

final documentsRepositoryProvider = Provider<DocumentsRepository>(
  (ref) => DocumentsRepository(ref.watch(sqApiProvider)),
);
