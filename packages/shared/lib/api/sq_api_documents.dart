import 'package:dio/dio.dart';

import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Клиентский лимит размера файла документа — совпадает с
/// `MaxFileSizeValidator({maxSize: 10 * 1024 * 1024})` бэкенда
/// (`backend/src/experts/documents.controller.ts`). Проверяется ДО
/// отправки запроса: сигнатуру файла (формат/magic bytes) бэкенд всё
/// равно валидирует сам (`FileSignatureValidator`), это клиенту
/// воспроизводить незачем — только лишний размер можно и нужно отсечь
/// локально, чтобы не гонять большой файл по сети впустую.
const documentMaxSizeBytes = 10 * 1024 * 1024;

/// Брошено [SqApiDocuments.uploadDocument], если файл превышает
/// [documentMaxSizeBytes] — до сетевого запроса, поэтому это не
/// [ApiException] (тот оборачивает только ответы бэкенда).
class DocumentTooLargeException implements Exception {
  const DocumentTooLargeException(this.sizeBytes);

  final int sizeBytes;

  @override
  String toString() =>
      'DocumentTooLargeException(sizeBytes: $sizeBytes, limit: $documentMaxSizeBytes)';
}

/// Документы верификации эксперта (E7 задача 5): загрузка по типу, список,
/// отправка анкеты на проверку.
mixin SqApiDocuments on SqApiBase {
  /// `POST /experts/me/documents/{type}` — загрузить документ (multipart,
  /// поле `file`). Бросает [DocumentTooLargeException] локально, если
  /// [bytes] больше [documentMaxSizeBytes] — без похода в сеть.
  Future<ExpertDocumentDto> uploadDocument(
    DocumentType type, {
    required List<int> bytes,
    required String filename,
  }) {
    if (bytes.length > documentMaxSizeBytes) {
      throw DocumentTooLargeException(bytes.length);
    }
    return guard(() async {
      final formData = FormData.fromMap({
        'file': MultipartFile.fromBytes(bytes, filename: filename),
      });
      final response = await dio.post<Map<String, dynamic>>(
        SqEndpoints.expertsMeDocumentByType(type.wireValue),
        data: formData,
      );
      return ExpertDocumentDto.fromJson(response.data!);
    });
  }

  /// `GET /experts/me/documents` — список из 4 позиций (по одной на
  /// каждый [DocumentType]; `status`/`updatedAt` — `null` для ещё не
  /// загруженного типа).
  Future<List<ExpertDocumentDto>> documents() => guard(() async {
        final response = await dio.get<List<dynamic>>(
          SqEndpoints.expertsMeDocuments,
        );
        return response.data!
            .cast<Map<String, dynamic>>()
            .map(ExpertDocumentDto.fromJson)
            .toList();
      });

  /// `POST /experts/me/documents/submit` — отправить анкету на проверку.
  /// `400 DOCUMENTS_INCOMPLETE`, если загружены не все 4 типа — бэкенд
  /// не перечисляет недостающие типы в ответе, поэтому UI сравнивает
  /// локальный результат [documents] с полным набором [DocumentType]
  /// сам (см. `DocumentsController` в `app_expert`).
  Future<SubmitVerificationDto> submitForVerification() => guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.expertsMeDocumentsSubmit,
        );
        return SubmitVerificationDto.fromJson(response.data!);
      });
}
