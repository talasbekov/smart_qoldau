/// Избранные специалисты клиента.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/catalog_repository.dart';

/// Размер страницы избранного — как у каталога и как умолчание бэкенда.
const favoritesPageSize = 20;

class FavoritesController extends AsyncNotifier<List<ExpertPublic>> {
  bool hasMore = true;
  bool _loadingMore = false;

  @override
  FutureOr<List<ExpertPublic>> build() => _page(skip: 0);

  Future<List<ExpertPublic>> _page({required int skip}) async {
    final page = await ref
        .read(catalogRepositoryProvider)
        .favorites(take: favoritesPageSize, skip: skip);
    hasMore = page.length == favoritesPageSize;
    return page;
  }

  /// Догружает следующую страницу избранного (E11a, задача 7).
  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || _loadingMore || !hasMore) return;
    _loadingMore = true;
    try {
      final page = await _page(skip: current.length);
      final ids = current.map((expert) => expert.id).toSet();
      state = AsyncData([
        ...current,
        ...page.where((expert) => !ids.contains(expert.id)),
      ]);
    } catch (error) {
      developer.log(
        'догрузка избранного не удалась: ${error.runtimeType}',
        name: 'FavoritesController',
      );
    } finally {
      _loadingMore = false;
    }
  }

  bool contains(String expertId) =>
      state.valueOrNull?.any((expert) => expert.id == expertId) ?? false;

  /// Переключает избранное ОПТИМИСТИЧНО: звезда загорается сразу, а при
  /// отказе сервера состояние откатывается на прежнее. Ждать круг сети,
  /// чтобы перекрасить иконку, — заметная задержка на ровном месте.
  Future<void> toggle(ExpertPublic expert) =>
      contains(expert.id) ? remove(expert) : add(expert);

  Future<void> add(ExpertPublic expert) async {
    final previous = state.valueOrNull ?? const <ExpertPublic>[];
    // `PUT /favorites/{id}` идемпотентен — состояние ведёт себя так же.
    if (previous.any((item) => item.id == expert.id)) return;

    state = AsyncData([...previous, expert]);
    try {
      await ref.read(catalogRepositoryProvider).addFavorite(expert.id);
    } catch (error) {
      developer.log(
        'избранное не сохранено: ${error.runtimeType}',
        name: 'FavoritesController',
      );
      state = AsyncData(previous);
    }
  }

  Future<void> remove(ExpertPublic expert) async {
    final previous = state.valueOrNull ?? const <ExpertPublic>[];
    state = AsyncData(
      previous.where((item) => item.id != expert.id).toList(),
    );
    try {
      await ref.read(catalogRepositoryProvider).removeFavorite(expert.id);
    } catch (error) {
      developer.log(
        'избранное не обновлено: ${error.runtimeType}',
        name: 'FavoritesController',
      );
      state = AsyncData(previous);
    }
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    hasMore = true;
    state = await AsyncValue.guard(() => _page(skip: 0));
  }
}

final favoritesControllerProvider =
    AsyncNotifierProvider<FavoritesController, List<ExpertPublic>>(
      FavoritesController.new,
    );

/// Быстрый ответ «этот специалист в избранном?» для звезды в карточке и в
/// профиле — без ручного разбора `AsyncValue` в каждом виджете.
final isFavoriteProvider = Provider.family<bool, String>((ref, expertId) {
  final favorites = ref.watch(favoritesControllerProvider).valueOrNull;
  return favorites?.any((expert) => expert.id == expertId) ?? false;
});
