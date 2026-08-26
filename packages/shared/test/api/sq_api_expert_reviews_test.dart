// Тесты SqApiExpertReviews: свои отзывы эксперта, ответ и жалоба
// (E7 задача 15, разблокирована бэкенд-эндпоинтом GET /experts/me/reviews).
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

SqApi _buildApi() => SqApi(
  baseUrl: 'https://api.test.local/v1',
  readTokens: () async => null,
  writeTokens: (_) async {},
  onLogout: () async {},
);

final _myReviewsFixture = {
  'items': [
    {
      'id': 'rev-1',
      'rating': 5,
      'publicText': 'Отличная консультация',
      'expertReply': null,
      'tags': ['attentive'],
      'createdAt': '2026-08-25T10:15:00.000Z',
    },
  ],
  'distribution': {'1': 0, '2': 0, '3': 0, '4': 1, '5': 3},
  'ratingAvg': 4.75,
  'ratingCount': 4,
};

void main() {
  late SqApi api;
  late DioAdapter dioAdapter;

  setUp(() {
    api = _buildApi();
    dioAdapter = DioAdapter(dio: api.dio);
  });

  group('MyExpertReviews round-trip', () {
    test('fromJson/toJson переносят все поля, включая id отзыва', () {
      final reviews = MyExpertReviews.fromJson(_myReviewsFixture);
      expect(reviews.items, hasLength(1));
      expect(reviews.items.single.id, 'rev-1');
      expect(reviews.items.single.rating, 5);
      expect(reviews.items.single.publicText, 'Отличная консультация');
      expect(reviews.items.single.expertReply, isNull);
      expect(reviews.items.single.tags, ['attentive']);
      expect(
        reviews.items.single.createdAt,
        DateTime.parse('2026-08-25T10:15:00.000Z'),
      );
      expect(reviews.distribution.rating4, 1);
      expect(reviews.distribution.rating5, 3);
      expect(reviews.ratingAvg, 4.75);
      expect(reviews.ratingCount, 4);

      expect(MyExpertReviews.fromJson(reviews.toJson()), reviews);
    });

    test('tags по умолчанию пустой, если бэкенд поле не прислал', () {
      final item = OwnReviewItem.fromJson({
        'id': 'rev-2',
        'rating': 3,
        'createdAt': '2026-08-25T10:15:00.000Z',
      });
      expect(item.tags, isEmpty);
      expect(item.publicText, isNull);
    });
  });

  group('SqApiExpertReviews', () {
    test('myReviews() → GET /experts/me/reviews', () async {
      dioAdapter.onGet(
        '/experts/me/reviews',
        (server) => server.reply(200, _myReviewsFixture),
      );

      final reviews = await api.myReviews();
      expect(reviews.items.single.id, 'rev-1');
      expect(reviews.ratingCount, 4);
    });

    test('myReviews(take, skip) прокидывает пагинацию в query', () async {
      dioAdapter.onGet(
        '/experts/me/reviews',
        (server) => server.reply(200, _myReviewsFixture),
        queryParameters: {'take': 10, 'skip': 20},
      );

      final reviews = await api.myReviews(take: 10, skip: 20);
      expect(reviews.items, hasLength(1));
    });

    test('replyToReview() → POST /reviews/{id}/reply с текстом', () async {
      dioAdapter.onPost(
        '/reviews/rev-1/reply',
        (server) => server.reply(200, null),
        data: {'text': 'Спасибо за отзыв!'},
      );

      await api.replyToReview('rev-1', 'Спасибо за отзыв!');
    });

    test('complainAboutReview() → POST /reviews/{id}/complaint', () async {
      dioAdapter.onPost(
        '/reviews/rev-1/complaint',
        (server) => server.reply(200, null),
        data: {'text': 'Отзыв не относится к консультации'},
      );

      await api.complainAboutReview(
        'rev-1',
        'Отзыв не относится к консультации',
      );
    });

    test('404 REVIEW_NOT_FOUND превращается в ApiException с кодом', () async {
      dioAdapter.onPost(
        '/reviews/foreign/reply',
        (server) => server.reply(404, {
          'error': {'code': 'REVIEW_NOT_FOUND', 'message': 'Отзыв не найден'},
        }),
        data: {'text': 'привет'},
      );

      expect(
        () => api.replyToReview('foreign', 'привет'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            ApiErrorCode.reviewNotFound,
          ),
        ),
      );
    });

    test(
      '409 INVALID_STATE_TRANSITION на жалобе доходит как ApiException',
      () async {
        dioAdapter.onPost(
          '/reviews/rev-1/complaint',
          (server) => server.reply(409, {
            'error': {
              'code': 'INVALID_STATE_TRANSITION',
              'message': 'Жалоба уже подана',
            },
          }),
          data: {'text': 'повтор'},
        );

        expect(
          () => api.complainAboutReview('rev-1', 'повтор'),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              ApiErrorCode.invalidStateTransition,
            ),
          ),
        );
      },
    );
  });
}
