/// Фильтры каталога и его выдача.
library;

import 'dart:async';

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

class CatalogController extends AsyncNotifier<List<ExpertPublic>> {
  @override
  FutureOr<List<ExpertPublic>> build() {
    // `watch`, а не `read`: смена фильтров обязана перезапрашивать выдачу.
    final filters = ref.watch(catalogFiltersProvider);
    return _load(filters);
  }

  Future<List<ExpertPublic>> _load(CatalogFilters filters) =>
      ref
          .read(catalogRepositoryProvider)
          .experts(
            topic: filters.topicSlug,
            language: filters.language,
            format: filters.format,
            sort: filters.sort?.wireValue,
          );

  /// «Повторить» на экране ошибки.
  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => _load(ref.read(catalogFiltersProvider)),
    );
  }
}

final catalogControllerProvider =
    AsyncNotifierProvider<CatalogController, List<ExpertPublic>>(
      CatalogController.new,
    );
