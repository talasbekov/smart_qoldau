import 'package:dio/dio.dart';

/// Полный словарь кодов ошибок бэкенда, релевантных клиентскому приложению
/// (см. `backend/src/common/filters/app-exception.filter.ts` и модули,
/// бросающие `apiError(code, message, status)`). Источник для локализации
/// текстов ошибок в задачах 5+ — сверяй новые коды с этим списком, не гадай.
///
/// Бэкенд знает больше кодов (админка/эксперт-приложение E7/E8) — сюда
/// сознательно вынесены только те, что может получить клиент.
abstract final class ApiErrorCode {
  static const validationFailed = 'VALIDATION_FAILED';
  static const unauthorized = 'UNAUTHORIZED';
  static const forbidden = 'FORBIDDEN';
  static const notFound = 'NOT_FOUND';
  static const conflict = 'CONFLICT';
  static const rateLimited = 'RATE_LIMITED';
  static const internal = 'INTERNAL';
  static const smsCodeInvalid = 'SMS_CODE_INVALID';
  static const smsCodeExpired = 'SMS_CODE_EXPIRED';
  static const smsRateLimited = 'SMS_RATE_LIMITED';
  static const phoneAlreadyRegistered = 'PHONE_ALREADY_REGISTERED';
  static const activeRequestExists = 'ACTIVE_REQUEST_EXISTS';
  static const expertUnavailable = 'EXPERT_UNAVAILABLE';
  static const expertNotFound = 'EXPERT_NOT_FOUND';
  static const expertBlocked = 'EXPERT_BLOCKED';
  static const expertExists = 'EXPERT_EXISTS';
  static const priceOutOfRange = 'PRICE_OUT_OF_RANGE';
  static const notVerified = 'NOT_VERIFIED';
  static const requestNotFound = 'REQUEST_NOT_FOUND';
  static const requestAlreadyClosed = 'REQUEST_ALREADY_CLOSED';
  static const consultationNotFound = 'CONSULTATION_NOT_FOUND';
  static const consultationNotActive = 'CONSULTATION_NOT_ACTIVE';
  static const paymentMethodNotFound = 'PAYMENT_METHOD_NOT_FOUND';
  static const paymentNotFound = 'PAYMENT_NOT_FOUND';
  static const providerDeclined = 'PROVIDER_DECLINED';
  static const alreadyPaid = 'ALREADY_PAID';
  static const reviewExists = 'REVIEW_EXISTS';
  static const reviewNotFound = 'REVIEW_NOT_FOUND';
  static const notificationNotFound = 'NOTIFICATION_NOT_FOUND';
  static const deviceNotFound = 'DEVICE_NOT_FOUND';
  static const ticketNotFound = 'TICKET_NOT_FOUND';
  static const ticketContactRequired = 'TICKET_CONTACT_REQUIRED';
  static const ticketCategoryNotAllowed = 'TICKET_CATEGORY_NOT_ALLOWED';
  static const ticketAlreadyResolved = 'TICKET_ALREADY_RESOLVED';

  /// Код, которым [ApiException.fromDioError] помечает сетевые сбои без
  /// ответа сервера (таймаут, обрыв соединения, DNS) — бэкенд его не знает,
  /// это чисто клиентское значение.
  static const network = 'NETWORK';
}

/// Ошибка API SmartQoldau — обёртка над телом `{"error": {"code",
/// "message", "details"}}`, которое отдаёт `AppExceptionFilter` бэкенда.
class ApiException implements Exception {
  const ApiException(this.code, this.message, this.statusCode, [this.details]);

  /// Код ошибки — см. [ApiErrorCode] для полного словаря, который знает
  /// клиент.
  final String code;

  final String message;

  final int statusCode;

  /// Доп. данные ошибки (`error.details` в теле ответа), если бэкенд их
  /// прислал. Может содержать что угодно из тела запроса/ответа — поэтому
  /// [toString] его никогда не печатает (см. класс-документацию).
  final Object? details;

  /// Разбирает [DioException] в [ApiException]:
  /// - есть ответ с телом `{"error": {...}}` — код/сообщение/детали оттуда;
  /// - ответ есть, но тело не в этом формате (невалидный JSON, HTML-страница
  ///   от прокси, пустое тело) — код [ApiErrorCode.internal];
  /// - ответа нет вообще (таймаут, обрыв соединения, DNS) — код
  ///   [ApiErrorCode.network].
  factory ApiException.fromDioError(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException(
        ApiErrorCode.network,
        error.message ?? 'Нет соединения с сервером',
        0,
      );
    }

    final statusCode = response.statusCode ?? 0;
    final data = response.data;
    if (data is Map) {
      final errorBody = data['error'];
      if (errorBody is Map) {
        final code = errorBody['code'];
        final message = errorBody['message'];
        if (code is String && message is String) {
          return ApiException(code, message, statusCode, errorBody['details']);
        }
      }
    }

    return ApiException(
      ApiErrorCode.internal,
      'Внутренняя ошибка сервера',
      statusCode,
    );
  }

  /// Осознанно не включает [details] (и вообще ничего из тела запроса или
  /// ответа) — тело может содержать PII (телефон, PAN, текст сообщений),
  /// которому не место в логах/крэш-репортах.
  @override
  String toString() => 'ApiException(code: $code, statusCode: $statusCode)';
}
