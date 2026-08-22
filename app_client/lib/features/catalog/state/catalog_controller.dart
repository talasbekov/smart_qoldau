/// Фильтры каталога и его выдача.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/catalog_repository.dart';

/// Сортировка каталога. Значения на проводе — из `ListExpertsDto` бэкенда.
enum CatalogSort { priceAsc, priceDesc, rating }

extension CatalogSortWire on CatalogSort {
  String get wireValue => switch (this) {
    CatalogSort.priceAsc => 'price_asc',
    CatalogSort.priceDesc => 'price_desc',
    CatalogSort.rating => 'rating',
  };
}

/// Набор фильтров каталога. `null` в поле — «без ограничения».
class CatalogFilters {
  const CatalogFilters({
    this.topicSlug,
    this.language,
    this.format,
    this.sort,
  });

  final String? topicSlug;
  final String? language;
  final SessionFormat? format;
  final CatalogSort? sort;

  bool get isEmpty =>
      topicSlug == null && language == null && format == null && sort == null;

  @override
  bool operator ==(Object other) =>
      other is CatalogFilters &&
      other.topicSlug == topicSlug &&
      other.language == language &&
      other.format == format &&
      other.sort == sort;

  @override
  int get hashCode => Object.hash(topicSlug, language, format, sort);
}

class CatalogFiltersController extends Notifier<CatalogFilters> {
  @override
  CatalogFilters build() => const CatalogFilters();

  /// Меняет только переданные поля. Чтобы СНЯТЬ фильтр, передайте
  /// соответствующий `clear*`: обычный `null` здесь означает «не трогать»,
  /// иначе снять одно значение, не сбросив остальные, было бы нельзя.
  void update({
    String? topicSlug,
    String? language,
    SessionFormat? format,
    CatalogSort? sort,
    bool clearTopic = false,
    bool clearLanguage = false,
    bool clearFormat = false,
    bool clearSort = false,
  }) {
    state = CatalogFilters(
      topicSlug: clearTopic ? null : (topicSlug ?? state.topicSlug),
      language: clearLanguage ? null : (language ?? state.language),
      format: clearFormat ? null : (format ?? state.format),
      sort: clearSort ? null : (sort ?? state.sort),
    );
  }

  void reset() => state = const CatalogFilters();
}

final catalogFiltersProvider =
    NotifierProvider<CatalogFiltersController, CatalogFilters>(
      CatalogFiltersController.new,
    );

/// Размер страницы каталога. Совпадает с умолчанием бэкенда (E11a,
/// задача 7): просить больше — значит упереться в его потолок в 100.
const catalogPageSize = 20;

class CatalogController extends AsyncNotifier<List<ExpertPublic>> {
  /// Есть ли ещё страницы. `false`, когда последняя страница пришла
  /// неполной — отдельного признака у эндпоинта нет.
  bool hasMore = true;

  bool _loadingMore = false;

  @override
  FutureOr<List<ExpertPublic>> build() {
    // `watch`, а не `read`: смена фильтров обязана перезапрашивать выдачу.
    final filters = ref.watch(catalogFiltersProvider);
    hasMore = true;
    return _load(filters, skip: 0);
  }

  Future<List<ExpertPublic>> _load(
    CatalogFilters filters, {
    required int skip,
  }) async {
    final page = await ref
        .read(catalogRepositoryProvider)
        .experts(
          topic: filters.topicSlug,
          language: filters.language,
          format: filters.format,
          sort: filters.sort?.wireValue,
          take: catalogPageSize,
          skip: skip,
        );
    hasMore = page.length == catalogPageSize;
    return page;
  }

  /// Догружает следующую страницу и дописывает её в конец. Дубли
  /// отсеиваются по id: порядок на сервере детерминирован, но повторный
  /// тап по кнопке не должен удваивать карточки.
  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || _loadingMore || !hasMore) return;
    _loadingMore = true;
    try {
      final page = await _load(
        ref.read(catalogFiltersProvider),
        skip: current.length,
      );
      final ids = current.map((expert) => expert.id).toSet();
      state = AsyncData([
        ...current,
        ...page.where((expert) => !ids.contains(expert.id)),
      ]);
    } catch (error) {
      developer.log(
        'догрузка каталога не удалась: ${error.runtimeType}',
        name: 'CatalogController',
      );
    } finally {
      _loadingMore = false;
    }
  }

  /// «Повторить» на экране ошибки.
  Future<void> retry() async {
    state = const AsyncLoading();
    hasMore = true;
    state = await AsyncValue.guard(
      () => _load(ref.read(catalogFiltersProvider), skip: 0),
    );
  }
}

final catalogControllerProvider =
    AsyncNotifierProvider<CatalogController, List<ExpertPublic>>(
      CatalogController.new,
    );
