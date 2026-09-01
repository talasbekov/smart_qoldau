// Юнит-тесты ExpertReviewsController (E7 задача 15, полная — бэкенд-долг
// `GET /experts/me/reviews` закрыт): лента грузится приватным эндпоинтом
// «мои отзывы» (не публичным по id), сбой сети переводит состояние в
// AsyncError, refresh() чинит, ответ и жалоба перечитывают ленту.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/reviews/state/expert_reviews_controller.dart';

class MockSqApi extends Mock implements SqApi {}

MyExpertReviews _reviews({String? expertReply}) => MyExpertReviews(
  items: [
    OwnReviewItem(
      id: 'rev-1',
      rating: 5,
      publicText: 'Очень помогло',
      expertReply: expertReply,
      createdAt: DateTime(2026, 8, 1),
    ),
  ],
  distribution: const RatingDistribution(
    rating1: 0,
    rating2: 0,
    rating3: 0,
    rating4: 1,
    rating5: 4,
  ),
  ratingAvg: 4.8,
  ratingCount: 5,
);

ProviderContainer _container(SqApi api) {
  final container = ProviderContainer(
    overrides: [sqApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
  });

  test('build() грузит СВОИ отзывы (GET /experts/me/reviews) c id', () async {
    when(() => api.myReviews(take: null, skip: null))
        .thenAnswer((_) async => _reviews());

    final container = _container(api);
    final result = await container.read(expertReviewsControllerProvider.future);

    expect(result.ratingCount, 5);
    expect(result.items.single.id, 'rev-1');
    verify(() => api.myReviews(take: null, skip: null)).called(1);
    // Публичный анонимный эндпоинт больше не используется — по нему
    // ответить на отзыв было нечем (нет id).
    verifyNever(() => api.expertReviews(any()));
  });

  test('сбой сети переводит состояние в AsyncError, refresh() чинит', () async {
    var fail = true;
    when(() => api.myReviews(take: null, skip: null)).thenAnswer((_) async {
      if (fail) throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
      return _reviews();
    });

    final container = _container(api);
    container.listen(
      expertReviewsControllerProvider,
      (previous, next) {},
      fireImmediately: true,
    );
    await Future<void>.delayed(Duration.zero);

    expect(container.read(expertReviewsControllerProvider).hasError, isTrue);

    fail = false;
    await container.read(expertReviewsControllerProvider.notifier).refresh();

    expect(
      container.read(expertReviewsControllerProvider).value?.ratingCount,
      5,
    );
  });

  test('reply() отправляет текст и перечитывает ленту', () async {
    var replied = false;
    when(() => api.myReviews(take: null, skip: null)).thenAnswer(
      (_) async => _reviews(expertReply: replied ? 'Спасибо!' : null),
    );
    when(() => api.replyToReview('rev-1', 'Спасибо!')).thenAnswer((_) async {
      replied = true;
    });

    final container = _container(api);
    await container.read(expertReviewsControllerProvider.future);

    await container
        .read(expertReviewsControllerProvider.notifier)
        .reply('rev-1', 'Спасибо!');

    verify(() => api.replyToReview('rev-1', 'Спасибо!')).called(1);
    expect(
      container
          .read(expertReviewsControllerProvider)
          .value
          ?.items
          .single
          .expertReply,
      'Спасибо!',
    );
  });

  test('complaint() отправляет текст и перечитывает ленту (отзыв уходит в FLAGGED)', () async {
    var complained = false;
    when(() => api.myReviews(take: null, skip: null)).thenAnswer(
      (_) async => complained
          ? const MyExpertReviews(
              items: [],
              distribution: RatingDistribution(
                rating1: 0,
                rating2: 0,
                rating3: 0,
                rating4: 1,
                rating5: 3,
              ),
              ratingAvg: 4.75,
              ratingCount: 4,
            )
          : _reviews(),
    );
    when(() => api.complainAboutReview('rev-1', 'не по делу'))
        .thenAnswer((_) async {
          complained = true;
        });

    final container = _container(api);
    await container.read(expertReviewsControllerProvider.future);

    await container
        .read(expertReviewsControllerProvider.notifier)
        .complaint('rev-1', 'не по делу');

    verify(() => api.complainAboutReview('rev-1', 'не по делу')).called(1);
    expect(
      container.read(expertReviewsControllerProvider).value?.items,
      isEmpty,
    );
    expect(
      container.read(expertReviewsControllerProvider).value?.ratingCount,
      4,
    );
  });

  test(
    'ошибка reply() пробрасывается наружу, лента остаётся видимой',
    () async {
      when(() => api.myReviews(take: null, skip: null))
          .thenAnswer((_) async => _reviews());
      when(() => api.replyToReview('rev-1', 'поздно')).thenThrow(
        const ApiException(
          ApiErrorCode.invalidStateTransition,
          'отзыв скрыт',
          409,
        ),
      );

      final container = _container(api);
      await container.read(expertReviewsControllerProvider.future);

      await expectLater(
        container
            .read(expertReviewsControllerProvider.notifier)
            .reply('rev-1', 'поздно'),
        throwsA(isA<ApiException>()),
      );
      expect(
        container.read(expertReviewsControllerProvider).value?.items,
        hasLength(1),
      );
    },
  );
}
