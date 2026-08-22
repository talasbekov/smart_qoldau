// Юнит-тесты FavoritesController (Step 2 брифа задачи 16): оптимистичное
// переключение с откатом и идемпотентность.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/features/catalog/state/favorites_controller.dart';

class MockSqApi extends Mock implements SqApi {}

ExpertPublic _expert(String id) => ExpertPublic(
  id: id,
  displayName: 'Специалист $id',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  priceTiyn: 399000,
  languages: const ['ru'],
  formats: const [SessionFormat.chat],
  topicSlugs: const ['anxiety-stress'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.9,
  ratingCount: 12,
);

ProviderContainer _container(SqApi api) {
  final container = ProviderContainer(
    overrides: [sqApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  container.listen(
    favoritesControllerProvider,
    (previous, next) {},
    fireImmediately: true,
  );
  return container;
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(() => api.favorites()).thenAnswer((_) async => [_expert('e1')]);
    when(() => api.addFavorite(any())).thenAnswer((_) async {});
    when(() => api.removeFavorite(any())).thenAnswer((_) async {});
  });

  test('добавление сразу отражается в состоянии, до ответа сервера', () async {
    final container = _container(api);
    await container.read(favoritesControllerProvider.future);
    final notifier = container.read(favoritesControllerProvider.notifier);

    final pending = notifier.toggle(_expert('e2'));

    expect(
      container.read(favoritesControllerProvider).requireValue.map((e) => e.id),
      ['e1', 'e2'],
      reason: 'звезда обязана загораться мгновенно, а не через круг сети',
    );

    await pending;
    verify(() => api.addFavorite('e2')).called(1);
  });

  test('ошибка добавления откатывает состояние', () async {
    when(() => api.addFavorite('e2')).thenAnswer(
      (_) async => throw const ApiException(ApiErrorCode.network, 'нет сети', 0),
    );

    final container = _container(api);
    await container.read(favoritesControllerProvider.future);

    await container.read(favoritesControllerProvider.notifier).toggle(
      _expert('e2'),
    );

    expect(
      container.read(favoritesControllerProvider).requireValue.map((e) => e.id),
      ['e1'],
    );
  });

  test('удаление из избранного тоже оптимистичное и откатывается', () async {
    // Именно `thenAnswer` с асинхронным броском, а не `thenThrow`: тот
    // бросает СИНХРОННО, ещё до первого await внутри контроллера, и откат
    // успевал бы произойти раньше, чем тест посмотрит на промежуточное
    // состояние — сетевой сбой так себя не ведёт (урок 5 плана эпика:
    // двойник не должен быть проще оригинала там, где живёт логика).
    when(() => api.removeFavorite('e1')).thenAnswer(
      (_) async => throw const ApiException(ApiErrorCode.network, 'нет сети', 0),
    );

    final container = _container(api);
    await container.read(favoritesControllerProvider.future);
    final notifier = container.read(favoritesControllerProvider.notifier);

    final pending = notifier.toggle(_expert('e1'));
    expect(
      container.read(favoritesControllerProvider).requireValue,
      isEmpty,
    );

    await pending;
    expect(
      container.read(favoritesControllerProvider).requireValue.map((e) => e.id),
      ['e1'],
    );
  });

  test('повторное добавление того же эксперта не дублирует его', () async {
    // `PUT /favorites/{id}` идемпотентен; состояние обязано вести себя так же.
    final container = _container(api);
    await container.read(favoritesControllerProvider.future);
    final notifier = container.read(favoritesControllerProvider.notifier);

    await notifier.add(_expert('e1'));
    await notifier.add(_expert('e1'));

    expect(
      container.read(favoritesControllerProvider).requireValue.map((e) => e.id),
      ['e1'],
    );
  });

  test('isFavorite отвечает по текущему состоянию', () async {
    final container = _container(api);
    await container.read(favoritesControllerProvider.future);

    expect(container.read(isFavoriteProvider('e1')), isTrue);
    expect(container.read(isFavoriteProvider('e2')), isFalse);
  });
}
