// Тесты SqApiNotes (E7 задача 13): заметки эксперта к консультации.
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

SqApi _buildApi() => SqApi(
  baseUrl: 'https://api.test.local/v1',
  readTokens: () async => null,
  writeTokens: (_) async {},
  onLogout: () async {},
);

void main() {
  late SqApi api;
  late DioAdapter dioAdapter;

  setUp(() {
    api = _buildApi();
    dioAdapter = DioAdapter(dio: api.dio);
  });

  test('note() при отсутствии заметки возвращает ExpertNoteDto(text: null), а не бросает', () async {
    dioAdapter.onGet(
      '/consultations/cons-1/note',
      (server) => server.reply(200, {'text': null}),
    );

    final note = await api.note('cons-1');
    expect(note.text, isNull);
  });

  test('note() с существующей заметкой возвращает text и updatedAt', () async {
    dioAdapter.onGet(
      '/consultations/cons-1/note',
      (server) => server.reply(200, {
        'text': 'клиент тревожен, назначен второй сеанс',
        'updatedAt': '2026-08-25T10:00:00.000Z',
      }),
    );

    final note = await api.note('cons-1');
    expect(note.text, 'клиент тревожен, назначен второй сеанс');
    expect(note.updatedAt, DateTime.parse('2026-08-25T10:00:00.000Z'));
  });

  test('saveNote() → PUT /consultations/{id}/note', () async {
    dioAdapter.onPut(
      '/consultations/cons-1/note',
      (server) => server.reply(200, {'text': 'новая заметка'}),
      data: {'text': 'новая заметка'},
    );

    final note = await api.saveNote('cons-1', 'новая заметка');
    expect(note.text, 'новая заметка');
  });

  test(
    'saveNote() при 400 INVALID_NOTE_TEXT пробрасывает ApiException',
    () async {
      dioAdapter.onPut(
        '/consultations/cons-1/note',
        (server) => server.reply(400, {
          'error': {
            'code': 'INVALID_NOTE_TEXT',
            'message': 'Текст не может быть пустым',
          },
        }),
        data: {'text': ''},
      );

      await expectLater(
        api.saveNote('cons-1', ''),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            ApiErrorCode.invalidNoteText,
          ),
        ),
      );
    },
  );

  test('completeConsultation() → POST /consultations/{id}/complete', () async {
    dioAdapter.onPost(
      '/consultations/cons-1/complete',
      (server) => server.reply(200, {
        'id': 'cons-1',
        'status': 'COMPLETED',
        'outcome': 'COMPLETED',
        'format': 'video',
        'isEmergency': false,
        'startedAt': '2026-08-25T10:00:00.000Z',
        'endedAt': '2026-08-25T10:30:00.000Z',
        'clientCode': 4821,
        'topicSlug': 'anxiety-stress',
        'priceTiyn': 500000,
        'plannedDurationMin': 30,
        'paymentStatus': 'CAPTURED',
      }),
      data: {'outcome': 'COMPLETED'},
    );

    final result = await api.completeConsultation(
      'cons-1',
      ConsultationOutcome.completed,
    );
    expect(result.status, ConsultationStatus.completed);
    expect(result.outcome, ConsultationOutcome.completed);
  });

  test('completeConsultation() при 409 CONSULTATION_NOT_ACTIVE пробрасывает понятный код', () async {
    dioAdapter.onPost(
      '/consultations/cons-1/complete',
      (server) => server.reply(409, {
        'error': {
          'code': 'CONSULTATION_NOT_ACTIVE',
          'message': 'Консультация уже завершена или отменена',
        },
      }),
      data: {'outcome': 'CLIENT_NO_SHOW'},
    );

    await expectLater(
      api.completeConsultation('cons-1', ConsultationOutcome.clientNoShow),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          ApiErrorCode.consultationNotActive,
        ),
      ),
    );
  });

  test(
    'expertConsultationById() парсит ответ как ConsultationExpertDto',
    () async {
      dioAdapter.onGet(
        '/consultations/cons-1',
        (server) => server.reply(200, {
          'id': 'cons-1',
          'status': 'ACTIVE',
          'outcome': null,
          'format': 'chat',
          'isEmergency': false,
          'startedAt': '2026-08-25T10:00:00.000Z',
          'endedAt': null,
          'clientCode': 4821,
          'topicSlug': 'anxiety-stress',
          'priceTiyn': 500000,
          'plannedDurationMin': 30,
          'paymentStatus': 'HELD',
        }),
      );

      final result = await api.expertConsultationById('cons-1');
      expect(result.clientCode, 4821);
      expect(result.topicSlug, 'anxiety-stress');
    },
  );
}
