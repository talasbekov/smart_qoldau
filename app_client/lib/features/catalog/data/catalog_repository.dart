/// Каталог специалистов, их профили, отзывы и избранное.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/providers.dart';

class CatalogRepository {
  const CatalogRepository(this._api);

  final SqApi _api;

  /// `GET /v1/experts` — каталог целиком под текущие фильтры.
  ///
  /// Пагинации у эндпоинта нет (см. `ListExpertsDto` бэкенда: только
  /// фильтры и сортировка), поэтому и в клиенте её нет — список приходит
  /// одним куском, а порядок задаёт сервер.
  Future<List<ExpertPublic>> experts({
    String? topic,
    String? language,
    SessionFormat? format,
    String? sort,
  }) => _api.experts(
    topic: topic,
    language: language,
    format: format,
    sort: sort,
  );

  /// `GET /v1/experts/{id}` — публичная карточка.
  Future<ExpertPublic> expert(String id) => _api.expertById(id);

  /// `GET /v1/experts/{id}/reviews` — публичные отзывы постранично.
  Future<ExpertReviews> reviews(String id, {int? take, int? skip}) =>
      _api.expertReviews(id, take: take, skip: skip);

  /// `GET /v1/favorites`.
  Future<List<ExpertPublic>> favorites() => _api.favorites();

  /// `PUT /v1/favorites/{expertId}` — идемпотентно.
  Future<void> addFavorite(String expertId) => _api.addFavorite(expertId);

  /// `DELETE /v1/favorites/{expertId}` — идемпотентно.
  Future<void> removeFavorite(String expertId) => _api.removeFavorite(expertId);
}

final catalogRepositoryProvider = Provider<CatalogRepository>(
  (ref) => CatalogRepository(ref.watch(sqApiProvider)),
);
