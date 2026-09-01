// Юнит-тесты ReviewController (Step 1 брифа задачи 15): отправка отзыва,
// пустые тексты, REVIEW_EXISTS, «Пропустить» и повторная запись к тому же
// специалисту.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/features/review/state/review_controller.dart';

class MockSqApi extends Mock implements SqApi {}

ReviewCreated _created() => ReviewCreated(
  id: 'rev-1',
  consultationId: 'c1',
  rating: 4,
  publicText: 'спасибо',
  createdAt: DateTime(2026, 8, 22, 11),
);

Future<ProviderContainer> _container(SqApi api) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final container = ProviderContainer(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
  );
  addTearDown(container.dispose);
  container.listen(
    reviewControllerProvider('c1'),
    (previous, next) {},
    fireImmediately: true,
  );
  return container;
}

ReviewState _state(ProviderContainer container) =>
    container.read(reviewControllerProvider('c1'));

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.chat));

  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    ).thenAnswer((_) async => _created());
  });

  test('без оценки отправка невозможна и в сеть не уходит', () async {
    final container = await _container(api);

    expect(_state(container).canSubmit, isFalse);
    await container.read(reviewControllerProvider('c1').notifier).submit();

    verifyNever(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    );
    expect(_state(container).phase, ReviewPhase.editing);
  });

  test('оценка и оба текста уходят как есть', () async {
    final container = await _container(api);
    final notifier = container.read(reviewControllerProvider('c1').notifier);

    notifier.setRating(4);
    notifier.setPublicText('спасибо');
    notifier.setPrivateText('всё хорошо');
    expect(_state(container).canSubmit, isTrue);

    await notifier.submit();

    verify(
      () => api.createReview(
        'c1',
        rating: 4,
        publicText: 'спасибо',
        privateText: 'всё хорошо',
      ),
    ).called(1);
    expect(_state(container).phase, ReviewPhase.sent);
  });

  test('пустые тексты уходят как null, а не пустой строкой', () async {
    // Пустая строка в публичном отзыве превратилась бы в пустой отзыв в
    // ленте специалиста — бэкенд отличает «нет текста» от «текст пустой».
    final container = await _container(api);
    final notifier = container.read(reviewControllerProvider('c1').notifier);

    notifier.setRating(5);
    notifier.setPublicText('   ');
    notifier.setPrivateText('');

    await notifier.submit();

    verify(
      () => api.createReview(
        'c1',
        rating: 5,
        publicText: null,
        privateText: null,
      ),
    ).called(1);
  });

  test('успешная отправка запоминает флаг и id отзыва', () async {
    // Id нужен, чтобы отзыв можно было удалить (ТЗ §5.7): эндпоинта
    // «мой отзыв по консультации» у бэкенда нет.
    final container = await _container(api);
    final notifier = container.read(reviewControllerProvider('c1').notifier);

    notifier.setRating(4);
    await notifier.submit();

    final prefs = container.read(sharedPreferencesProvider);
    expect(prefs.getBool('sq.reviewed.c1'), isTrue);
    expect(prefs.getString('sq.reviewId.c1'), 'rev-1');
  });

  test('REVIEW_EXISTS показывает своё состояние и не шлёт повтор', () async {
    when(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    ).thenThrow(const ApiException(ApiErrorCode.reviewExists, 'already', 409));

    final container = await _container(api);
    final notifier = container.read(reviewControllerProvider('c1').notifier);
    notifier.setRating(4);

    await notifier.submit();
    expect(_state(container).phase, ReviewPhase.alreadyExists);

    await notifier.submit();
    verify(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    ).called(1);
    // Оценивать заново нечего — флаг ставится и в этой ветке.
    expect(
      container.read(sharedPreferencesProvider).getBool('sq.reviewed.c1'),
      isTrue,
    );
  });

  test('сбой сети оставляет экран редактируемым', () async {
    when(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    ).thenThrow(const ApiException(ApiErrorCode.network, 'нет сети', 0));

    final container = await _container(api);
    final notifier = container.read(reviewControllerProvider('c1').notifier);
    notifier.setRating(4);

    await notifier.submit();

    expect(_state(container).phase, ReviewPhase.editing);
    expect(_state(container).errorCode, ApiErrorCode.network);
    expect(
      container.read(sharedPreferencesProvider).getBool('sq.reviewed.c1'),
      isNull,
      reason: 'неотправленный отзыв не должен считаться показанным',
    );
  });

  test('«Пропустить» ставит флаг, но ничего не отправляет', () async {
    final container = await _container(api);

    await container.read(reviewControllerProvider('c1').notifier).skip();

    expect(
      container.read(sharedPreferencesProvider).getBool('sq.reviewed.c1'),
      isTrue,
    );
    verifyNever(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    );
  });

  test(
    'повторная запись создаёт адресную заявку к тому же специалисту',
    () async {
      when(
        () => api.createRequest(
          topicSlug: any(named: 'topicSlug'),
          format: any(named: 'format'),
          isEmergency: any(named: 'isEmergency'),
          expertId: any(named: 'expertId'),
        ),
      ).thenAnswer(
        (_) async => const MatchRequest(
          id: 'r-directed',
          status: RequestStatus.searching,
          isEmergency: false,
          clientCode: 1234,
        ),
      );

      final container = await _container(api);
      final request = await container
          .read(reviewControllerProvider('c1').notifier)
          .continueWithExpert(
            expertId: 'e1',
            topicSlug: 'anxiety-stress',
            format: SessionFormat.chat,
          );

      verify(
        () => api.createRequest(
          topicSlug: 'anxiety-stress',
          format: SessionFormat.chat,
          isEmergency: false,
          expertId: 'e1',
        ),
      ).called(1);
      expect(request?.id, 'r-directed');
    },
  );

  test('двойной тап по «Завершить» не создаёт два отзыва', () async {
    final container = await _container(api);
    final notifier = container.read(reviewControllerProvider('c1').notifier);
    notifier.setRating(5);

    await Future.wait([notifier.submit(), notifier.submit()]);

    verify(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    ).called(1);
  });
}
