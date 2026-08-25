/// Отзывы о текущем эксперте: тонкая обёртка над `SqApiExperts.expertReviews`
/// (E7 задача 15).
///
/// ДОЛГ (задокументирован в Plane, задача заведена в Backlog проекта Smart
/// Qoldau): «Ответить»/«Пожаловаться» из брифа задачи 15 НЕ реализованы.
/// `GET /experts/{id}/reviews` (`ReviewItemDto`) полностью анонимизирован
/// по замыслу — предназначен для публичного каталога клиента и намеренно
/// не несёт `id` отзыва вообще нигде в ответе (см. комментарий
/// `ReviewItemDto` бэкенда: «ПОЛНАЯ анонимность»). `POST /reviews/{id}
/// /reply`/`/complaint` требуют этот `id`, а единственное место, где он
/// вообще возвращается — `ReviewCreatedDto` клиенту в момент создания
/// отзыва, эксперту недоступно. Реализовать ответ/жалобу без нового
/// бэкенд-эндпоинта (`GET /experts/me/reviews` с `id` в ответе)
/// невозможно — это работа отдельного эпика/бэкенд-задачи, не фронтенда.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class ExpertReviewsRepository {
  const ExpertReviewsRepository(this._api);

  final SqApi _api;

  /// Собственный id эксперта — нужен как параметр `expertReviews(id)`
  /// (публичный эндпоинт, id в пути — не «мои отзывы», а «отзывы об этом
  /// эксперте»; для себя он просто известен из своего же профиля).
  Future<String> myExpertId() async => (await _api.me()).id;

  /// `GET /experts/{id}/reviews` — отзывы + распределение оценок.
  Future<ExpertReviews> reviews(String expertId, {int? take, int? skip}) =>
      _api.expertReviews(expertId, take: take, skip: skip);
}

final expertReviewsRepositoryProvider = Provider<ExpertReviewsRepository>(
  (ref) => ExpertReviewsRepository(ref.watch(sqApiProvider)),
);
