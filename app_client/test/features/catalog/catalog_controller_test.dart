// Юнит-тесты CatalogController (Step 1 брифа задачи 16): фильтры уходят на
// сервер теми же именами параметров, сортировка передаётся как есть, а
// ошибка сети даёт состояние ошибки с повтором.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/features/catalog/state/catalog_controller.dart';

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
    catalogControllerProvider,
    (previous, next) {},
    fireImmediately: true,
  );
  return container;
}

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.chat));

  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(
      () => api.experts(
        topic: any(named: 'topic'),
        language: any(named: 'language'),
        format: any(named: 'format'),
        sort: any(named: 'sort'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => [_expert('e1'), _expert('e2')]);
  });

  test('без фильтров запрос уходит без единого параметра', () async {
    final container = _container(api);
    await container.read(catalogControllerProvider.future);

    verify(
      () => api.experts(
        topic: null,
        language: null,
        format: null,
        sort: null,
        take: catalogPageSize,
        skip: 0,
      ),
    ).called(1);
    expect(container.read(catalogControllerProvider).requireValue.length, 2);
  });

  test('смена фильтров шлёт ровно выбранные значения', () async {
    final container = _container(api);
    await container.read(catalogControllerProvider.future);

    container
        .read(catalogFiltersProvider.notifier)
        .update(
          topicSlug: 'burnout',
          language: 'kz',
          format: SessionFormat.video,
        );
    await container.read(catalogControllerProvider.future);

    verify(
      () => api.experts(
        topic: 'burnout',
        language: 'kz',
        format: SessionFormat.video,
        sort: null,
        take: catalogPageSize,
        skip: 0,
      ),
    ).called(1);
  });

  test('сортировка по рейтингу уходит как sort=rating', () async {
    final container = _container(api);
    await container.read(catalogControllerProvider.future);

    container.read(catalogFiltersProvider.notifier).update(sort: CatalogSort.rating);
    await container.read(catalogControllerProvider.future);

    verify(
      () => api.experts(
        topic: null,
        language: null,
        format: null,
        sort: 'rating',
        take: catalogPageSize,
        skip: 0,
      ),
    ).called(1);
  });

  test('сброс фильтров возвращает запрос без параметров', () async {
    final container = _container(api);
    final filters = container.read(catalogFiltersProvider.notifier);

    filters.update(topicSlug: 'burnout', sort: CatalogSort.priceAsc);
    await container.read(catalogControllerProvider.future);

    filters.reset();
    await container.read(catalogControllerProvider.future);

    verify(
      () => api.experts(
        topic: null,
        language: null,
        format: null,
        sort: null,
        take: catalogPageSize,
        skip: 0,
      ),
    ).called(2);
  });

  test('клиент не пересортировывает выдачу сервера', () async {
    // Порядок задаёт сервер (sort=price_asc и т.п.); локальная сортировка
    // разошлась бы с ним на равных значениях и меняла бы список под
    // пальцем при каждом обновлении.
    final cheap = _expert('cheap');
    final expensive = ExpertPublic(
      id: 'expensive',
      displayName: 'Дорогой',
      city: 'Астана',
      experience: ExperienceLevel.moreThanTen,
      priceTiyn: 900000,
      languages: const ['ru'],
      formats: const [SessionFormat.chat],
      topicSlugs: const ['anxiety-stress'],
      workStatus: WorkStatus.accepting,
      ratingAvg: 4.1,
      ratingCount: 3,
    );
    when(
      () => api.experts(
        topic: any(named: 'topic'),
        language: any(named: 'language'),
        format: any(named: 'format'),
        sort: any(named: 'sort'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => [expensive, cheap]);

    final container = _container(api);
    container.read(catalogFiltersProvider.notifier).update(sort: CatalogSort.priceAsc);
    final list = await container.read(catalogControllerProvider.future);

    expect(list.map((e) => e.id), ['expensive', 'cheap']);
  });

  test('loadMore дописывает следующую страницу без дублей', () async {
    // Каталог приходит страницами по 20 (E11a, задача 7): без догрузки
    // клиент показывал бы только первые двадцать записей.
    final firstPage = List.generate(20, (i) => _expert('p1-$i'));
    final secondPage = [
      // Сервер может вернуть пересечение при одновременном добавлении
      // эксперта: дубли обязаны отсеиваться по id.
      firstPage.last,
      _expert('p2-0'),
    ];
    when(
      () => api.experts(
        topic: any(named: 'topic'),
        language: any(named: 'language'),
        format: any(named: 'format'),
        sort: any(named: 'sort'),
        take: any(named: 'take'),
        skip: 0,
      ),
    ).thenAnswer((_) async => firstPage);
    when(
      () => api.experts(
        topic: any(named: 'topic'),
        language: any(named: 'language'),
        format: any(named: 'format'),
        sort: any(named: 'sort'),
        take: any(named: 'take'),
        skip: 20,
      ),
    ).thenAnswer((_) async => secondPage);

    final container = _container(api);
    await container.read(catalogControllerProvider.future);

    await container.read(catalogControllerProvider.notifier).loadMore();

    final list = container.read(catalogControllerProvider).requireValue;
    expect(list.length, 21);
    expect(list.map((e) => e.id).toSet().length, 21);
  });

  test('неполная страница означает конец списка', () async {
    when(
      () => api.experts(
        topic: any(named: 'topic'),
        language: any(named: 'language'),
        format: any(named: 'format'),
        sort: any(named: 'sort'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => [_expert('e1')]);

    final container = _container(api);
    await container.read(catalogControllerProvider.future);

    expect(
      container.read(catalogControllerProvider.notifier).hasMore,
      isFalse,
      reason: 'отдельного признака «есть ещё» у эндпоинта нет — судим по '
          'неполной странице',
    );
  });

  test('ошибка сети даёт состояние ошибки, повтор возвращает список', () async {
    var calls = 0;
    when(
      () => api.experts(
        topic: any(named: 'topic'),
        language: any(named: 'language'),
        format: any(named: 'format'),
        sort: any(named: 'sort'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async {
      calls++;
      if (calls == 1) {
        throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
      }
      return [_expert('e1')];
    });

    final container = _container(api);
    await expectLater(
      container.read(catalogControllerProvider.future),
      throwsA(isA<ApiException>()),
    );
    expect(container.read(catalogControllerProvider).hasError, isTrue);

    await container.read(catalogControllerProvider.notifier).retry();

    expect(container.read(catalogControllerProvider).requireValue.length, 1);
  });
}
