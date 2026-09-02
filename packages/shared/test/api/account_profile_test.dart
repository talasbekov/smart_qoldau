// Р-27: профиль клиента и согласие на видимость психологу.
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

  group('ClientProfile', () {
    test('новый человек согласия не давал', () {
      final profile = ClientProfile.fromJson({
        'displayName': null,
        'expertVisibilityAcceptedAt': null,
      });

      expect(profile.displayName, isNull);
      expect(profile.expertVisibilityAcceptedAt, isNull);
      expect(profile.needsExpertVisibilityConsent, isTrue);
    });

    test('после согласия дата разобрана и согласие больше не нужно', () {
      final profile = ClientProfile.fromJson({
        'displayName': 'Айгерим',
        'expertVisibilityAcceptedAt': '2026-09-02T10:00:00.000Z',
      });

      expect(profile.displayName, 'Айгерим');
      expect(
        profile.expertVisibilityAcceptedAt,
        DateTime.parse('2026-09-02T10:00:00.000Z'),
      );
      expect(profile.needsExpertVisibilityConsent, isFalse);
    });
  });

  group('SqApiAccount', () {
    test('GET /me отдаёт профиль', () async {
      dioAdapter.onGet(
        '/me',
        (server) => server.reply(200, {
          'displayName': 'Айгерим',
          'expertVisibilityAcceptedAt': '2026-09-02T10:00:00.000Z',
        }),
      );

      final profile = await api.profile();

      expect(profile.displayName, 'Айгерим');
      expect(profile.needsExpertVisibilityConsent, isFalse);
    });

    test('POST /me/expert-visibility шлёт имя и возвращает профиль', () async {
      dioAdapter.onPost(
        '/me/expert-visibility',
        (server) => server.reply(200, {
          'displayName': 'Айгерим',
          'expertVisibilityAcceptedAt': '2026-09-02T10:00:00.000Z',
        }),
        data: {'displayName': 'Айгерим'},
      );

      final profile = await api.acceptExpertVisibility('Айгерим');

      expect(profile.displayName, 'Айгерим');
      expect(profile.needsExpertVisibilityConsent, isFalse);
    });
  });
}
