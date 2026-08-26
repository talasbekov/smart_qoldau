// Тесты SqApiExpertProfile: методы профиля эксперта.
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

SqApi _buildApi() => SqApi(
  baseUrl: 'https://api.test.local/v1',
  readTokens: () async => null,
  writeTokens: (_) async {},
  onLogout: () async {},
);

final expertMeJsonFixture = {
  'id': 'exp-1',
  'displayName': 'Айгуль Серикова',
  'city': 'Алматы',
  'experience': 'THREE_TO_FIVE',
  'education': 'КазНУ, психология',
  'priceTiyn': 500000,
  'languages': ['ru', 'kz'],
  'formats': ['chat', 'audio'],
  'topicSlugs': ['anxiety', 'stress'],
  'verificationStatus': 'DRAFT',
  'workStatus': 'ACCEPTING',
  'isBlocked': false,
  'acceptsUrgent': true,
  'photoUrl': null,
  'photoStatus': 'NONE',
  'about': null,
  'aboutStatus': 'NONE',
  'moderationComment': null,
};

void main() {
  late SqApi api;
  late DioAdapter dioAdapter;

  setUp(() {
    api = _buildApi();
    dioAdapter = DioAdapter(dio: api.dio);
  });

  group('SqApiExpertProfile.createExpert', () {
    test(
      'createExpert отправляет корректное тело и разбирает ExpertMeDto',
      () async {
        dioAdapter.onPost(
          '/experts',
          (server) => server.reply(201, expertMeJsonFixture),
          data: {
            'displayName': 'Айгуль Серикова',
            'city': 'Алматы',
            'experience': 'THREE_TO_FIVE',
            'education': 'КазНУ, психология',
            'priceTiyn': 500000,
            'languages': ['ru', 'kz'],
            'formats': ['chat', 'audio'],
            'topicSlugs': ['anxiety', 'stress'],
          },
        );
        final result = await api.createExpert(
          displayName: 'Айгуль Серикова',
          city: 'Алматы',
          experience: ExperienceLevel.threeToFive,
          education: 'КазНУ, психология',
          priceTiyn: 500000,
          languages: ['ru', 'kz'],
          formats: [SessionFormat.chat, SessionFormat.audio],
          topicSlugs: ['anxiety', 'stress'],
        );
        expect(result.verificationStatus, VerificationStatus.draft);
        expect(result.displayName, 'Айгуль Серикова');
      },
    );

    test(
      'createExpert при PRICE_OUT_OF_RANGE пробрасывает ApiException',
      () async {
        dioAdapter.onPost(
          '/experts',
          (server) => server.reply(400, {
            'error': {
              'code': 'PRICE_OUT_OF_RANGE',
              'message': 'Цена вне диапазона',
            },
          }),
          data: {
            'displayName': 'Айгуль Серикова',
            'city': 'Алматы',
            'experience': 'THREE_TO_FIVE',
            'education': 'КазНУ, психология',
            'priceTiyn': 500000,
            'languages': ['ru'],
            'formats': ['chat'],
            'topicSlugs': ['anxiety'],
          },
        );
        expect(
          () => api.createExpert(
            displayName: 'Айгуль Серикова',
            city: 'Алматы',
            experience: ExperienceLevel.threeToFive,
            education: 'КазНУ, психология',
            priceTiyn: 500000,
            languages: ['ru'],
            formats: [SessionFormat.chat],
            topicSlugs: ['anxiety'],
          ),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              ApiErrorCode.priceOutOfRange,
            ),
          ),
        );
      },
    );

    test('createExpert при EXPERT_EXISTS пробрасывает ApiException', () async {
      dioAdapter.onPost(
        '/experts',
        (server) => server.reply(409, {
          'error': {
            'code': 'EXPERT_EXISTS',
            'message': 'Эксперт уже существует',
          },
        }),
        data: {
          'displayName': 'Айгуль Серикова',
          'city': 'Алматы',
          'experience': 'THREE_TO_FIVE',
          'education': 'КазНУ, психология',
          'priceTiyn': 500000,
          'languages': ['ru'],
          'formats': ['chat'],
          'topicSlugs': ['anxiety'],
        },
      );
      expect(
        () => api.createExpert(
          displayName: 'Айгуль Серикова',
          city: 'Алматы',
          experience: ExperienceLevel.threeToFive,
          education: 'КазНУ, психология',
          priceTiyn: 500000,
          languages: ['ru'],
          formats: [SessionFormat.chat],
          topicSlugs: ['anxiety'],
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            ApiErrorCode.expertExists,
          ),
        ),
      );
    });
  });

  group('SqApiExpertProfile.me', () {
    test('me возвращает текущий профиль эксперта', () async {
      dioAdapter.onGet(
        '/experts/me',
        (server) => server.reply(200, expertMeJsonFixture),
      );
      final result = await api.me();
      expect(result.id, 'exp-1');
      expect(result.displayName, 'Айгуль Серикова');
      expect(result.verificationStatus, VerificationStatus.draft);
    });

    test('me при NOT_VERIFIED пробрасывает ApiException', () async {
      dioAdapter.onGet(
        '/experts/me',
        (server) => server.reply(403, {
          'error': {
            'code': 'NOT_VERIFIED',
            'message': 'Профиль не верифицирован',
          },
        }),
      );
      expect(
        () => api.me(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            ApiErrorCode.notVerified,
          ),
        ),
      );
    });
  });

  group('SqApiExpertProfile.updateExpert', () {
    test(
      'updateExpert отправляет обновленные данные и возвращает ExpertMeDto',
      () async {
        final updatedFixture = {
          ...expertMeJsonFixture,
          'about': 'Психолог с опытом работы с тревожностью',
          'aboutStatus': 'PENDING',
        };
        dioAdapter.onPatch(
          '/experts/me',
          (server) => server.reply(200, updatedFixture),
          data: {
            'city': 'Алматы',
            'experience': 'THREE_TO_FIVE',
            'education': 'КазНУ, психология',
            'priceTiyn': 500000,
            'languages': ['ru', 'kz'],
            'formats': ['chat', 'audio'],
            'topicSlugs': ['anxiety', 'stress'],
            'about': 'Психолог с опытом работы с тревожностью',
          },
        );
        final result = await api.updateExpert(
          city: 'Алматы',
          experience: ExperienceLevel.threeToFive,
          education: 'КазНУ, психология',
          priceTiyn: 500000,
          languages: ['ru', 'kz'],
          formats: [SessionFormat.chat, SessionFormat.audio],
          topicSlugs: ['anxiety', 'stress'],
          about: 'Психолог с опытом работы с тревожностью',
        );
        expect(result.about, 'Психолог с опытом работы с тревожностью');
        expect(result.aboutStatus, ProfileFieldStatus.pending);
      },
    );
  });

  group('SqApiExpertProfile.setWorkStatus', () {
    test(
      'setWorkStatus отправляет статус работы и возвращает ExpertMeDto',
      () async {
        final updatedFixture = {...expertMeJsonFixture, 'workStatus': 'BUSY'};
        dioAdapter.onPatch(
          '/experts/me/work-status',
          (server) => server.reply(200, updatedFixture),
          data: {'status': 'BUSY'},
        );
        final result = await api.setWorkStatus(WorkStatus.busy);
        expect(result.workStatus, WorkStatus.busy);
      },
    );
  });

  group('SqApiExpertProfile.heartbeat', () {
    test('heartbeat отправляет POST без тела', () async {
      dioAdapter.onPost(
        '/experts/me/heartbeat',
        (server) => server.reply(204, null),
      );
      await api.heartbeat();
    });
  });
}
