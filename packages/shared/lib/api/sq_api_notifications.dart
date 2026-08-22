import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Центр уведомлений, регистрация устройств и локаль пользователя.
mixin SqApiNotifications on SqApiBase {
  /// `GET /notifications` — центр уведомлений постранично + бейдж.
  Future<NotificationsPage> notifications({int? take, int? skip}) =>
      guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.notifications,
          queryParameters: {
            'take': ?take,
            'skip': ?skip,
          },
        );
        return NotificationsPage.fromJson(response.data!);
      });

  /// `POST /notifications/read` — прочитать уведомления (без [ids] — все
  /// свои).
  Future<void> markNotificationsRead({List<String>? ids}) => guard(() async {
        await dio.post<void>(
          SqEndpoints.notificationsRead,
          data: {'ids': ?ids},
        );
      });

  /// `POST /devices` — регистрация push-токена устройства (upsert).
  Future<void> registerDevice({
    required String platform,
    required String token,
    String? locale,
  }) =>
      guard(() async {
        await dio.post<void>(
          SqEndpoints.devices,
          data: {
            'platform': platform,
            'token': token,
            'locale': ?locale,
          },
        );
      });

  /// `PATCH /me/locale` — локаль пользователя (язык уведомлений).
  Future<void> updateLocale(String locale) => guard(() async {
        await dio.patch<void>(
          SqEndpoints.meLocale,
          data: {'locale': locale},
        );
      });
}
