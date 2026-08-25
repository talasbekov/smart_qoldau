// Юнит-тесты DocumentsController (E7 задача 5): submit() активен только
// когда все 4 типа документа загружены (status != null), повторная
// загрузка одного типа заменяет запись в состоянии, а не добавляет вторую.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/verification/state/documents_controller.dart';

class MockSqApi extends Mock implements SqApi {}

ExpertDocumentDto _doc(
  DocumentType type, {
  DocumentStatus? status,
  DateTime? updatedAt,
}) => ExpertDocumentDto(type: type, status: status, updatedAt: updatedAt);

List<ExpertDocumentDto> _emptyDocuments() =>
    DocumentType.values.map((t) => _doc(t)).toList();

ProviderContainer _makeContainer(SqApi api) {
  final container = ProviderContainer(
    overrides: [sqApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  setUpAll(() {
    registerFallbackValue(DocumentType.identity);
  });

  group('DocumentsController.build', () {
    test('загружает документы и раскладывает их по типу', () async {
      final api = MockSqApi();
      when(() => api.documents()).thenAnswer(
        (_) async => [
          _doc(DocumentType.identity, status: DocumentStatus.uploaded),
          ..._emptyDocuments().where((d) => d.type != DocumentType.identity),
        ],
      );
      final container = _makeContainer(api);

      await container.read(documentsControllerProvider.future);

      final state = container.read(documentsControllerProvider).value!;
      expect(state[DocumentType.identity]?.status, DocumentStatus.uploaded);
      expect(state[DocumentType.diploma]?.status, isNull);
    });
  });

  group('DocumentsController.canSubmit', () {
    test('false, пока не все 4 типа загружены', () async {
      final api = MockSqApi();
      when(() => api.documents()).thenAnswer(
        (_) async => [
          _doc(DocumentType.identity, status: DocumentStatus.uploaded),
          _doc(DocumentType.diploma, status: DocumentStatus.uploaded),
          _doc(DocumentType.certificates, status: DocumentStatus.uploaded),
          _doc(DocumentType.qualification),
        ],
      );
      final container = _makeContainer(api);
      final controller = container.read(documentsControllerProvider.notifier);

      await container.read(documentsControllerProvider.future);

      expect(controller.canSubmit, isFalse);
    });

    test('true, когда все 4 типа в статусе, отличном от null', () async {
      final api = MockSqApi();
      when(() => api.documents()).thenAnswer(
        (_) async => DocumentType.values
            .map((t) => _doc(t, status: DocumentStatus.uploaded))
            .toList(),
      );
      final container = _makeContainer(api);
      final controller = container.read(documentsControllerProvider.notifier);

      await container.read(documentsControllerProvider.future);

      expect(controller.canSubmit, isTrue);
    });
  });

  group('DocumentsController.upload', () {
    test('повторная загрузка того же типа заменяет запись в состоянии, а не добавляет вторую', () async {
      final api = MockSqApi();
      when(() => api.documents()).thenAnswer((_) async => _emptyDocuments());
      final firstUpload = _doc(
        DocumentType.identity,
        status: DocumentStatus.uploaded,
        updatedAt: DateTime(2026, 1, 1),
      );
      final reupload = _doc(
        DocumentType.identity,
        status: DocumentStatus.uploaded,
        updatedAt: DateTime(2026, 1, 2),
      );
      var call = 0;
      when(
        () => api.uploadDocument(
          any(),
          bytes: any(named: 'bytes'),
          filename: any(named: 'filename'),
        ),
      ).thenAnswer((_) async {
        call += 1;
        return call == 1 ? firstUpload : reupload;
      });
      final container = _makeContainer(api);
      final controller = container.read(documentsControllerProvider.notifier);
      await container.read(documentsControllerProvider.future);

      await controller.upload(
        DocumentType.identity,
        bytes: const [1, 2, 3],
        filename: 'a.pdf',
      );
      await controller.upload(
        DocumentType.identity,
        bytes: const [4, 5, 6],
        filename: 'b.pdf',
      );

      final state = container.read(documentsControllerProvider).value!;
      expect(state.length, DocumentType.values.length);
      expect(state[DocumentType.identity], reupload);
    });
  });

  group('DocumentsController.submit', () {
    test('не вызывает API, если не все 4 типа загружены', () async {
      final api = MockSqApi();
      when(() => api.documents()).thenAnswer((_) async => _emptyDocuments());
      final container = _makeContainer(api);
      final controller = container.read(documentsControllerProvider.notifier);
      await container.read(documentsControllerProvider.future);

      await controller.submit();

      verifyNever(() => api.submitForVerification());
    });

    test('вызывает API, когда все 4 типа загружены', () async {
      final api = MockSqApi();
      when(() => api.documents()).thenAnswer(
        (_) async => DocumentType.values
            .map((t) => _doc(t, status: DocumentStatus.uploaded))
            .toList(),
      );
      when(() => api.submitForVerification()).thenAnswer(
        (_) async =>
            const SubmitVerificationDto(verificationStatus: VerificationStatus.pending),
      );
      final container = _makeContainer(api);
      final controller = container.read(documentsControllerProvider.notifier);
      await container.read(documentsControllerProvider.future);

      await controller.submit();

      verify(() => api.submitForVerification()).called(1);
    });
  });
}
