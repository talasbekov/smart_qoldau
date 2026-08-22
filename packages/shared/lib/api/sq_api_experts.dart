import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Справочник тем, каталог экспертов и избранное.
mixin SqApiExperts on SqApiBase {
  /// `GET /topics` — справочник тем консультаций.
  Future<List<Topic>> topics({String? locale}) => guard(() async {
        final response = await dio.get<List<dynamic>>(
          SqEndpoints.topics,
          queryParameters: {'locale': ?locale},
        );
        return response.data!
            .map((e) => Topic.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  /// `GET /experts` — публичный список экспертов (VERIFIED, не
  /// заблокированные), с фильтрами каталога.
  Future<List<ExpertPublic>> experts({
    String? topic,
    String? language,
    SessionFormat? format,
    String? sort,
  }) =>
      guard(() async {
        final response = await dio.get<List<dynamic>>(
          SqEndpoints.experts,
          queryParameters: {
            'topic': ?topic,
            'language': ?language,
            if (format != null) 'format': format.wireValue,
            'sort': ?sort,
          },
        );
        return response.data!
            .map((e) => ExpertPublic.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  /// `GET /experts/{id}` — публичная карточка эксперта.
  Future<ExpertPublic> expertById(String id) => guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.expertById(id),
        );
        return ExpertPublic.fromJson(response.data!);
      });

  /// `GET /experts/{id}/reviews` — публичные отзывы эксперта постранично.
  Future<ExpertReviews> expertReviews(String id, {int? take, int? skip}) =>
      guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.expertReviews(id),
          queryParameters: {
            'take': ?take,
            'skip': ?skip,
          },
        );
        return ExpertReviews.fromJson(response.data!);
      });

  /// `GET /favorites` — список избранных экспертов.
  Future<List<ExpertPublic>> favorites() => guard(() async {
        final response = await dio.get<List<dynamic>>(SqEndpoints.favorites);
        return response.data!
            .map((e) => ExpertPublic.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  /// `PUT /favorites/{expertId}` — добавить эксперта в избранное
  /// (идемпотентно).
  Future<void> addFavorite(String expertId) => guard(() async {
        await dio.put<void>(SqEndpoints.favoriteExpert(expertId));
      });

  /// `DELETE /favorites/{expertId}` — убрать эксперта из избранного
  /// (идемпотентно).
  Future<void> removeFavorite(String expertId) => guard(() async {
        await dio.delete<void>(SqEndpoints.favoriteExpert(expertId));
      });
}
