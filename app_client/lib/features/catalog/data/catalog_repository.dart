/// Каталог специалистов, их профили, отзывы и избранное.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/providers.dart';

class CatalogRepository {
  const CatalogRepository(this._api);

  final SqApi _api;

  /// `GET /v1/experts` — страница каталога под текущие фильтры.
  ///
  /// Пагинация появилась в E11a (задача 7): без `take` бэкенд отдаёт
  /// первые 20 записей, максимум 100. Порядок задаёт сервер и он
  /// детерминирован (вторичный ключ `id`), поэтому страницы можно просто
  /// склеивать.
  Future<List<ExpertPublic>> experts({
    String? topic,
    String? language,
    SessionFormat? format,
    String? sort,
    int? take,
    int? skip,
  }) => _api.experts(
    topic: topic,
    language: language,
    format: format,
    sort: sort,
    take: take,
    skip: skip,
  );

  /// `GET /v1/experts/{id}` — публичная карточка.
  Future<ExpertPublic> expert(String id) => _api.expertById(id);

  /// `GET /v1/experts/{id}/reviews` — публичные отзывы постранично.
  Future<ExpertReviews> reviews(String id, {int? take, int? skip}) =>
      _api.expertReviews(id, take: take, skip: skip);

  /// `GET /v1/favorites` — страница избранного (E11a, задача 7).
  Future<List<ExpertPublic>> favorites({int? take, int? skip}) =>
      _api.favorites(take: take, skip: skip);

  /// `PUT /v1/favorites/{expertId}` — идемпотентно.
  Future<void> addFavorite(String expertId) => _api.addFavorite(expertId);

  /// `DELETE /v1/favorites/{expertId}` — идемпотентно.
  Future<void> removeFavorite(String expertId) => _api.removeFavorite(expertId);
}

final catalogRepositoryProvider = Provider<CatalogRepository>(
  (ref) => CatalogRepository(ref.watch(sqApiProvider)),
);
