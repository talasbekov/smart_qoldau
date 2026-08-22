/// Избранные специалисты клиента.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/catalog_repository.dart';

class FavoritesController extends AsyncNotifier<List<ExpertPublic>> {
  @override
  FutureOr<List<ExpertPublic>> build() =>
      ref.read(catalogRepositoryProvider).favorites();

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
    state = await AsyncValue.guard(
      () => ref.read(catalogRepositoryProvider).favorites(),
    );
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
