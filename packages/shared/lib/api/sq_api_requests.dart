import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Заявки на подбор эксперта и счётчик доступных онлайн.
mixin SqApiRequests on SqApiBase {
  /// `POST /requests` — создать заявку на консультацию.
  Future<MatchRequest> createRequest({
    required String topicSlug,
    required SessionFormat format,
    bool isEmergency = false,
    String? expertId,
  }) => guard(() async {
    final response = await dio.post<Map<String, dynamic>>(
      SqEndpoints.requests,
      data: {
        'topicSlug': topicSlug,
        'format': format.wireValue,
        'isEmergency': isEmergency,
        'expertId': ?expertId,
      },
    );
    return MatchRequest.fromJson(response.data!);
  });

  /// `GET /requests/{id}` — статус своей заявки.
  Future<MatchRequest> requestById(String id) => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.requestById(id),
    );
    return MatchRequest.fromJson(response.data!);
  });

  /// `POST /requests/{id}/cancel` — отменить свою заявку.
  Future<MatchRequest> cancelRequest(String id) => guard(() async {
    final response = await dio.post<Map<String, dynamic>>(
      SqEndpoints.requestCancel(id),
    );
    return MatchRequest.fromJson(response.data!);
  });

  /// `GET /matching/online-count` — число доступных под фильтр экспертов
  /// онлайн (для экрана поиска, ТЗ §5.3, БП-01). Реализовано в задаче 9
  /// эпика E6; ответ — только `{count}`, без id экспертов.
  Future<OnlineCount> onlineCount({
    required String topicSlug,
    required SessionFormat format,
    bool? urgentOnly,
  }) => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.matchingOnlineCount,
      queryParameters: {
        'topicSlug': topicSlug,
        'format': format.wireValue,
        'urgentOnly': ?urgentOnly,
      },
    );
    return OnlineCount.fromJson(response.data!);
  });
}
