/// Состояние вкладки «Материалы»: список с фильтром и стрик.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/content_repository.dart';

class ContentFilter {
  const ContentFilter({this.kind, this.category});

  final ContentKind? kind;
  final String? category;

  @override
  bool operator ==(Object other) =>
      other is ContentFilter &&
      other.kind == kind &&
      other.category == category;

  @override
  int get hashCode => Object.hash(kind, category);
}

final contentFilterProvider = StateProvider<ContentFilter>(
  (ref) => const ContentFilter(),
);

/// Страница библиотеки. Сервер отдаёт материалы постранично, и показать
/// первую страницу, промолчав об остальных, — то же самое, что не показать
/// материалы вовсе.
const contentPageSize = 20;

class ContentListState {
  const ContentListState({
    this.items = const [],
    this.loadingMore = false,
    this.hasMore = true,
  });

  final List<ContentItem> items;
  final bool loadingMore;
  final bool hasMore;
}

class ContentListController
    extends AutoDisposeAsyncNotifier<ContentListState> {
  @override
  FutureOr<ContentListState> build() async {
    final filter = ref.watch(contentFilterProvider);
    final page = await _fetch(filter, 0);
    return ContentListState(
      items: page,
      hasMore: page.length == contentPageSize,
    );
  }

  Future<List<ContentItem>> _fetch(ContentFilter filter, int skip) =>
      ref
          .read(contentRepositoryProvider)
          .list(
            kind: filter.kind,
            category: filter.category,
            take: contentPageSize,
            skip: skip,
          );

  /// Догружает следующую страницу. Повторные вызовы во время загрузки
  /// игнорируются: прокрутка дёргает обработчик десятки раз подряд.
  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || current.loadingMore || !current.hasMore) return;

    state = AsyncData(
      ContentListState(
        items: current.items,
        loadingMore: true,
        hasMore: current.hasMore,
      ),
    );
    try {
      final page = await _fetch(
        ref.read(contentFilterProvider),
        current.items.length,
      );
      state = AsyncData(
        ContentListState(
          items: [...current.items, ...page],
          hasMore: page.length == contentPageSize,
        ),
      );
    } catch (_) {
      // Сбой догрузки не должен стирать уже показанное: возвращаем прежний
      // список и позволяем попробовать снова прокруткой.
      state = AsyncData(
        ContentListState(items: current.items, hasMore: current.hasMore),
      );
    }
  }
}

final contentListProvider =
    AsyncNotifierProvider.autoDispose<ContentListController, ContentListState>(
      ContentListController.new,
    );

/// Стрик практик. Отдельно от списка: он меняется от прохождения материала,
/// а не от смены фильтра.
final contentStreakProvider = FutureProvider.autoDispose<ContentStreak>(
  (ref) => ref.watch(contentRepositoryProvider).streak(),
);

/// Карточка материала с телом.
final contentItemProvider = FutureProvider.autoDispose
    .family<ContentItem, String>(
      (ref, id) => ref.watch(contentRepositoryProvider).byId(id),
    );
