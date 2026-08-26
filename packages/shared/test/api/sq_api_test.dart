// Тесты на SqApi поверх http_mock_adapter: (а) SqApiBase.guard() оборачивает
// в ApiException не только DioException, но и любое другое исключение,
// возникающее при разборе успешного ответа (например TypeError в
// сгенерированном fromJson на неожиданной форме данных); (б) методы с
// query-параметрами реально шлют те имена ключей, что задокументированы —
// опечатка вроде 'take' вместо 'limit' или 'topicSlug' вместо 'topic' даёт
// AssertionError от мок-адаптера (failOnMissingMock), а не тихо проходит.
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
  late DioAdapter adapter;

  setUp(() {
    api = _buildApi();
    adapter = DioAdapter(dio: api.dio);
  });

  group('SqApiBase.guard error normalization', () {
    test(
      'wraps a non-Dio exception (malformed response body) into ApiException',
      () async {
        adapter.onGet(
          '/topics',
          (server) => server.reply(200, [
            {'unexpected': 'shape'},
          ]),
        );

        await expectLater(
          api.topics(),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              ApiErrorCode.internal,
            ),
          ),
        );
      },
    );

    test('still wraps a real DioException (e.g. 404) as before', () async {
      adapter.onGet(
        '/experts/missing-id',
        (server) => server.reply(404, {
          'error': {'code': 'EXPERT_NOT_FOUND', 'message': 'not found'},
        }),
      );

      await expectLater(
        api.expertById('missing-id'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            ApiErrorCode.expertNotFound,
          ),
        ),
      );
    });
  });

  group('createReview', () {
    test('возвращает созданный отзыв — бэкенд отдаёт ReviewCreatedDto с id, '
        'и без него удалить свой отзыв (ТЗ §5.7) будет нечем', () async {
      adapter.onPost(
        '/consultations/c1/review',
        (server) => server.reply(201, {
          'id': 'rev-1',
          'consultationId': 'c1',
          'rating': 5,
          'publicText': 'спасибо',
          'createdAt': '2026-08-22T10:00:00.000Z',
        }),
        data: {'rating': 5, 'publicText': 'спасибо'},
      );

      final review = await api.createReview(
        'c1',
        rating: 5,
        publicText: 'спасибо',
      );

      expect(review.id, 'rev-1');
      expect(review.consultationId, 'c1');
      expect(review.rating, 5);
      expect(review.publicText, 'спасибо');
    });

    test(
      'приватный текст в ответе не возвращается и полем модели не является',
      () async {
        // `ReviewCreatedDto` бэкенда собирается явным перечислением полей и
        // privateText автору НЕ отдаёт (виден только админ-API). Модель
        // повторяет это 1:1 — поля просто нет.
        adapter.onPost(
          '/consultations/c1/review',
          (server) => server.reply(201, {
            'id': 'rev-2',
            'consultationId': 'c1',
            'rating': 4,
            'publicText': null,
            'createdAt': '2026-08-22T10:00:00.000Z',
          }),
          data: {'rating': 4, 'privateText': 'жалоба'},
        );

        final review = await api.createReview(
          'c1',
          rating: 4,
          privateText: 'жалоба',
        );

        expect(review.publicText, isNull);
        expect(review.toJson().containsKey('privateText'), isFalse);
      },
    );
  });

  group('query parameter building', () {
    test('experts() sends topic/language/format/sort with the documented key names', () async {
      adapter.onGet(
        '/experts',
        (server) => server.reply(200, <dynamic>[]),
        queryParameters: {
          'topic': 'anxiety-stress',
          'language': 'kz',
          'format': 'video',
          'sort': 'price_asc',
        },
      );

      final result = await api.experts(
        topic: 'anxiety-stress',
        language: 'kz',
        format: SessionFormat.video,
        sort: 'price_asc',
      );

      expect(result, isEmpty);
    });

    test('experts() sends take/skip alongside filters — без них бэкенд отдаёт '
        'только первую страницу (E11a, задача 7)', () async {
      adapter.onGet(
        '/experts',
        (server) => server.reply(200, []),
        queryParameters: {
          'topic': 'anxiety-stress',
          'sort': 'rating',
          'take': 20,
          'skip': 20,
        },
      );

      await api.experts(
        topic: 'anxiety-stress',
        sort: 'rating',
        take: 20,
        skip: 20,
      );
    });

    test('favorites() sends take/skip with the documented key names', () async {
      adapter.onGet(
        '/favorites',
        (server) => server.reply(200, []),
        queryParameters: {'take': 10, 'skip': 30},
      );

      await api.favorites(take: 10, skip: 30);
    });

    test(
      'consultations() sends as/status/take/skip with the documented key names',
      () async {
        adapter.onGet(
          '/consultations',
          (server) => server.reply(200, <dynamic>[]),
          queryParameters: {
            'as': 'client',
            'status': 'ACTIVE',
            'take': 10,
            'skip': 5,
          },
        );

        final result = await api.consultations(
          status: ConsultationStatus.active,
          take: 10,
          skip: 5,
        );

        expect(result, isEmpty);
      },
    );

    test(
      'consultationMessages() sends cursor/limit with the documented key names',
      () async {
        adapter.onGet(
          '/consultations/c1/messages',
          (server) => server.reply(200, {'items': <dynamic>[]}),
          queryParameters: {'cursor': 'abc', 'limit': 20},
        );

        final result = await api.consultationMessages(
          'c1',
          cursor: 'abc',
          limit: 20,
        );

        expect(result.items, isEmpty);
      },
    );

    test(
      'expertReviews() sends take/skip with the documented key names',
      () async {
        adapter.onGet(
          '/experts/e1/reviews',
          (server) => server.reply(200, {
            'items': <dynamic>[],
            'distribution': {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0},
            'ratingAvg': 0,
            'ratingCount': 0,
          }),
          queryParameters: {'take': 5, 'skip': 15},
        );

        final result = await api.expertReviews('e1', take: 5, skip: 15);

        expect(result.items, isEmpty);
      },
    );

    test('tickets() sends take/skip with the documented key names', () async {
      adapter.onGet(
        '/tickets',
        (server) => server.reply(200, <dynamic>[]),
        queryParameters: {'take': 3, 'skip': 0},
      );

      final result = await api.tickets(take: 3, skip: 0);

      expect(result, isEmpty);
    });

    test('onlineCount() sends topicSlug/format/urgentOnly with the documented key names', () async {
      adapter.onGet(
        '/matching/online-count',
        (server) => server.reply(200, {'count': 4}),
        queryParameters: {
          'topicSlug': 'burnout',
          'format': 'chat',
          'urgentOnly': true,
        },
      );

      final result = await api.onlineCount(
        topicSlug: 'burnout',
        format: SessionFormat.chat,
        urgentOnly: true,
      );

      expect(result.count, 4);
    });
  });
}
