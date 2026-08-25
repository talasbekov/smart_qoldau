// Тесты SqApiDocuments: документы верификации эксперта (E7 задача 5).
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

SqApi _buildApi() => SqApi(
      baseUrl: 'https://api.test.local/v1',
      readTokens: () async => null,
      writeTokens: (_) async {},
      onLogout: () async {},
    );

final _documentJsonFixture = {
  'type': 'IDENTITY',
  'status': 'UPLOADED',
  'updatedAt': '2026-08-25T10:00:00.000Z',
};

void main() {
  late SqApi api;
  late DioAdapter dioAdapter;

  setUp(() {
    api = _buildApi();
    dioAdapter = DioAdapter(dio: api.dio);
  });

  group('ExpertDocumentDto round-trip', () {
    test('fromJson/toJson переносят все поля, включая null-статус ещё не загруженного документа', () {
      final uploaded = ExpertDocumentDto.fromJson(_documentJsonFixture);
      expect(uploaded.type, DocumentType.identity);
      expect(uploaded.status, DocumentStatus.uploaded);
      expect(uploaded.updatedAt, DateTime.parse('2026-08-25T10:00:00.000Z'));

      final notUploaded = ExpertDocumentDto.fromJson({
        'type': 'DIPLOMA',
        'status': null,
      });
      expect(notUploaded.type, DocumentType.diploma);
      expect(notUploaded.status, isNull);
      expect(notUploaded.updatedAt, isNull);

      final json = uploaded.toJson();
      expect(json['type'], 'IDENTITY');
      expect(json['status'], 'UPLOADED');
    });
  });

  group('SqApiDocuments.uploadDocument', () {
    test('отправляет multipart POST с полем file и разбирает ExpertDocumentDto', () async {
      final bytes = [0, 1, 2, 3];
      dioAdapter.onPost(
        '/experts/me/documents/IDENTITY',
        (server) => server.reply(201, _documentJsonFixture),
        data: FormData.fromMap({
          'file': MultipartFile.fromBytes(bytes, filename: 'passport.pdf'),
        }),
      );

      final result = await api.uploadDocument(
        DocumentType.identity,
        bytes: bytes,
        filename: 'passport.pdf',
      );

      expect(result.type, DocumentType.identity);
      expect(result.status, DocumentStatus.uploaded);
    });

    test('файл больше 10 МБ отклоняется на клиенте без сетевого запроса', () async {
      final oversized = List<int>.filled(documentMaxSizeBytes + 1, 0);

      expect(
        () => api.uploadDocument(
          DocumentType.identity,
          bytes: oversized,
          filename: 'passport.pdf',
        ),
        throwsA(isA<DocumentTooLargeException>()),
      );
    });
  });

  group('SqApiDocuments.documents', () {
    test('возвращает список из 4 позиций', () async {
      dioAdapter.onGet(
        '/experts/me/documents',
        (server) => server.reply(200, [
          _documentJsonFixture,
          {'type': 'DIPLOMA', 'status': null},
          {'type': 'CERTIFICATES', 'status': null},
          {'type': 'QUALIFICATION', 'status': null},
        ]),
      );

      final result = await api.documents();

      expect(result, hasLength(4));
      expect(result.first.type, DocumentType.identity);
      expect(result.first.status, DocumentStatus.uploaded);
      expect(result[1].status, isNull);
    });
  });

  group('SqApiDocuments.submitForVerification', () {
    test('успешная отправка возвращает новый verificationStatus', () async {
      dioAdapter.onPost(
        '/experts/me/documents/submit',
        (server) => server.reply(200, {'verificationStatus': 'PENDING'}),
      );

      final result = await api.submitForVerification();

      expect(result.verificationStatus, VerificationStatus.pending);
    });

    test('при DOCUMENTS_INCOMPLETE пробрасывает ApiException', () async {
      dioAdapter.onPost(
        '/experts/me/documents/submit',
        (server) => server.reply(400, {
          'error': {
            'code': 'DOCUMENTS_INCOMPLETE',
            'message': 'Не все документы загружены',
          }
        }),
      );

      expect(
        () => api.submitForVerification(),
        throwsA(isA<ApiException>().having(
          (e) => e.code,
          'code',
          'DOCUMENTS_INCOMPLETE',
        )),
      );
    });
  });
}
