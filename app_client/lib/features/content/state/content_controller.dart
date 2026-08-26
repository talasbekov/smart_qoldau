/// Состояние вкладки «Материалы»: список с фильтром и стрик.
library;

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

/// Список материалов под текущий фильтр. Перезапрашивается сервером, а не
/// фильтруется на клиенте: список растёт, и тянуть его целиком ради чипса
/// незачем.
final contentListProvider = FutureProvider.autoDispose<List<ContentItem>>((
  ref,
) {
  final filter = ref.watch(contentFilterProvider);
  return ref
      .watch(contentRepositoryProvider)
      .list(kind: filter.kind, category: filter.category);
});

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
