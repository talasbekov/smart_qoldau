import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Профиль клиента и согласие на видимость психологу (Р-27).
mixin SqApiAccount on SqApiBase {
  /// `GET /me` — имя и отметка согласия.
  Future<ClientProfile> profile() => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(SqEndpoints.me);
    return ClientProfile.fromJson(response.data!);
  });

  /// `POST /me/expert-visibility` — согласиться, что психолог видит имя и
  /// историю встреч, и назвать имя. Согласие спрашивается ОДИН раз;
  /// повторный вызов меняет имя, но не дату согласия.
  Future<ClientProfile> acceptExpertVisibility(String displayName) =>
      guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.meExpertVisibility,
          data: {'displayName': displayName},
        );
        return ClientProfile.fromJson(response.data!);
      });
}
