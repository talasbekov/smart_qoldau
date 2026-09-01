import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

const _kindValues = {
  ContentKind.meditation: 'MEDITATION',
  ContentKind.music: 'MUSIC',
  ContentKind.article: 'ARTICLE',
  ContentKind.breathing: 'BREATHING',
};

/// Библиотека самопомощи (E13).
mixin SqApiContent on SqApiBase {
  /// `GET /content` — карточки на языке пользователя.
  Future<List<ContentItem>> content({
    ContentKind? kind,
    String? category,
    int? take,
    int? skip,
  }) => guard(() async {
    final response = await dio.get<List<dynamic>>(
      SqEndpoints.content,
      queryParameters: {
        'kind': ?(kind == null ? null : _kindValues[kind]),
        'category': ?category,
        // Библиотека постраничная: без параметров сервер отдаёт первую
        // страницу, и молча показать только её значило бы потерять
        // остальные материалы.
        'take': ?take,
        'skip': ?skip,
      },
    );
    return response.data!
        .map((e) => ContentItem.fromJson(e as Map<String, dynamic>))
        .toList();
  });

  /// `GET /content/{id}` — карточка с телом материала.
  Future<ContentItem> contentItem(String id) => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.contentById(id),
    );
    return ContentItem.fromJson(response.data!);
  });

  /// `GET /content/{id}/media` — подписанная ссылка на файл. Материал за
  /// подпиской без неё отвечает 403 `PREMIUM_REQUIRED`: пейволл держится
  /// здесь, а не на замке в интерфейсе.
  Future<ContentMedia> contentMedia(String id) => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.contentMedia(id),
    );
    return ContentMedia.fromJson(response.data!);
  });

  /// `POST /content/{id}/progress` — доля прочитанного/прослушанного.
  Future<ContentProgress> saveContentProgress(String id, int permille) =>
      guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.contentProgress(id),
          data: {'positionPermille': permille},
        );
        return ContentProgress.fromJson(response.data!);
      });

  /// `POST /content/{id}/vote` — «было полезно?».
  Future<ContentVotes> voteContent(String id, {required bool useful}) =>
      guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.contentVote(id),
          data: {'useful': useful},
        );
        return ContentVotes.fromJson(response.data!);
      });

  /// `GET /content/streak` — стрик и счётчик пройденного.
  Future<ContentStreak> contentStreak() => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.contentStreak,
    );
    return ContentStreak.fromJson(response.data!);
  });
}
