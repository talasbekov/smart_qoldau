import 'package:dio/dio.dart';

import 'api_exception.dart';

/// Общая инфраструктура для всех модулей `SqApi`: HTTP-клиент и единая
/// обёртка ошибок, на которые опираются миксины модулей (`on SqApiBase`) —
/// auth/experts/requests/consultations/payments/notifications/tickets.
abstract class SqApiBase {
  Dio get dio;

  /// Выполняет [action]; любая [DioException] превращается в
  /// [ApiException]. Если ошибка уже нормализована выше по цепочке (см.
  /// `AuthInterceptor`, который кладёт готовый [ApiException] в
  /// `DioException.error` при провале рефреша), она используется как есть —
  /// не заворачивается повторно.
  Future<T> guard<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      final error = e.error;
      if (error is ApiException) {
        throw error;
      }
      throw ApiException.fromDioError(e);
    }
  }
}
