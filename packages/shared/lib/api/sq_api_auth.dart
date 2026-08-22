import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Вход и гостевой доступ (`/auth/*`).
mixin SqApiAuth on SqApiBase {
  /// `POST /auth/request-code` — запросить SMS-код входа.
  Future<void> requestCode(String phone) => guard(() async {
        await dio.post<void>(
          SqEndpoints.authRequestCode,
          data: {'phone': phone},
        );
      });

  /// `POST /auth/verify-code` — подтвердить SMS-код и получить токены.
  Future<Tokens> verifyCode(String phone, String code) => guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.authVerifyCode,
          data: {'phone': phone, 'code': code},
        );
        return Tokens.fromJson(response.data!);
      });

  /// `POST /auth/refresh` — обновить пару токенов по refresh-токену.
  ///
  /// Обычно рефреш выполняет `AuthInterceptor` сам, на 401 — этот метод
  /// нужен для ручного вызова (например, при запуске приложения).
  Future<Tokens> refresh(String refreshToken) => guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.authRefresh,
          data: {'refreshToken': refreshToken},
        );
        return Tokens.fromJson(response.data!);
      });

  /// `POST /auth/guest` — гостевой вход по `deviceId` (идемпотентно).
  Future<Tokens> guestLogin(String deviceId) => guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.authGuest,
          data: {'deviceId': deviceId},
        );
        return Tokens.fromJson(response.data!);
      });

  /// `POST /auth/guest/convert` — конверсия гостя в аккаунт по телефону.
  Future<Tokens> convertGuest(String phone, String code) => guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.authGuestConvert,
          data: {'phone': phone, 'code': code},
        );
        return Tokens.fromJson(response.data!);
      });
}
