// Юнит-тесты ExpertReviewsController (E7 задача 15, урезано — см. долг в
// ExpertReviewsRepository): лента загружается по СОБСТВЕННОМУ id эксперта
// (из me()), сбой сети переводит состояние в AsyncError, refresh() чинит.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/reviews/state/expert_reviews_controller.dart';

class MockSqApi extends Mock implements SqApi {}

ExpertMe _me() => const ExpertMe(
  id: 'exp-1',
  displayName: 'Айгуль Т.',
  city: 'Алматы',
  experience: ExperienceLevel.oneToThree,
  education: 'КазНУ',
  priceTiyn: 500000,
  languages: ['ru'],
  formats: [SessionFormat.chat],
  topicSlugs: ['anxiety-stress'],
  verificationStatus: VerificationStatus.verified,
  workStatus: WorkStatus.accepting,
  isBlocked: false,
  acceptsUrgent: false,
  photoStatus: ProfileFieldStatus.none,
  aboutStatus: ProfileFieldStatus.none,
);

ExpertReviews _reviews() => ExpertReviews(
  items: [
    ReviewItem(rating: 5, publicText: 'Очень помогло', createdAt: DateTime(2026, 8, 1)),
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
  final container = ProviderContainer(overrides: [sqApiProvider.overrideWithValue(api)]);
  addTearDown(container.dispose);
  return container;
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
  });

  test('build() грузит отзывы по id из me(), не по произвольному значению', () async {
    when(() => api.me()).thenAnswer((_) async => _me());
    when(() => api.expertReviews('exp-1', take: null, skip: null))
        .thenAnswer((_) async => _reviews());

    final container = _container(api);
    final result = await container.read(expertReviewsControllerProvider.future);

    expect(result.ratingCount, 5);
    verify(() => api.expertReviews('exp-1', take: null, skip: null)).called(1);
  });

  test('сбой сети переводит состояние в AsyncError, refresh() чинит', () async {
    when(() => api.me()).thenAnswer((_) async => _me());
    var fail = true;
    when(() => api.expertReviews('exp-1', take: null, skip: null)).thenAnswer((_) async {
      if (fail) throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
      return _reviews();
    });

    final container = _container(api);
    container.listen(expertReviewsControllerProvider, (previous, next) {}, fireImmediately: true);
    await Future<void>.delayed(Duration.zero);

    expect(container.read(expertReviewsControllerProvider).hasError, isTrue);

    fail = false;
    await container.read(expertReviewsControllerProvider.notifier).refresh();

    expect(container.read(expertReviewsControllerProvider).value?.ratingCount, 5);
  });
}
