import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Вход и гостевой доступ (`/auth/*`).
mixin SqApiAuth on SqApiBase {
  /// `POST /auth/request-code` — запросить SMS-код входа.
  Future<void> requestCode(String phone) => guard(() async {
    await dio.post<void>(SqEndpoints.authRequestCode, data: {'phone': phone});
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
  /// Этот метод только строит сам HTTP-запрос — координацию поверх него
  /// (single-flight, персист результата) берёт на себя `TokenRefresher`
  /// (`token_refresher.dart`), единственный владелец обновления токенов на
  /// клиент: им пользуются и `AuthInterceptor` (реагирует на HTTP-401), и
  /// шина реалтайм-событий (реагирует на разрыв, похожий на отказ
  /// аутентификации) — через один и тот же инстанс, чтобы не гоняться за
  /// одним и тем же одноразовым refresh-токеном независимо. Вызывать этот
  /// метод напрямую в обход `TokenRefresher` не следует.
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

  /// `DELETE /me` — удалить свой аккаунт и данные (ТЗ §5.1).
  ///
  /// Возврата нет: телефон освобождается, и повторный вход по нему заводит
  /// новый аккаунт. Консультации, платежи и проводки остаются как учётные
  /// записи — их нельзя терять по запросу одной из сторон, — но переписка,
  /// заметки, устройства, карты и тексты отзывов удаляются.
  ///
  /// `409 CONSULTATION_IN_PROGRESS` — идёт или запланирована консультация;
  /// `409 PAYMENT_IN_PROGRESS` — не закрыт расчёт;
  /// `409 EXPERT_DELETE_VIA_SUPPORT` — у специалиста удаление только через
  /// поддержку.
  Future<void> deleteAccount() => guard(() async {
    await dio.delete<void>(SqEndpoints.me);
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
