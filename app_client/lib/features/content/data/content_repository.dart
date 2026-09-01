/// Библиотека самопомощи (E13) — тонкий фасад над `SqApi`.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class ContentRepository {
  const ContentRepository(this._api);

  final SqApi _api;

  Future<List<ContentItem>> list({
    ContentKind? kind,
    String? category,
    int? take,
    int? skip,
  }) => _api.content(kind: kind, category: category, take: take, skip: skip);

  Future<ContentItem> byId(String id) => _api.contentItem(id);

  /// Ссылка на файл. Материал за подпиской без неё отвечает 403 —
  /// проверять доступ на клиенте не нужно и нельзя.
  Future<ContentMedia> media(String id) => _api.contentMedia(id);

  Future<ContentProgress> saveProgress(String id, int permille) =>
      _api.saveContentProgress(id, permille);

  Future<ContentVotes> vote(String id, {required bool useful}) =>
      _api.voteContent(id, useful: useful);

  Future<ContentStreak> streak() => _api.contentStreak();
}

final contentRepositoryProvider = Provider<ContentRepository>(
  (ref) => ContentRepository(ref.watch(sqApiProvider)),
);
