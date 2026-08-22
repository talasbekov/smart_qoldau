import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_exception.dart';

/// Читает текущую пару токенов, либо `null`, если пользователь ещё не вошёл
/// (гость без токенов вообще не бывает — гостевой вход тоже выдаёт [Tokens],
/// но до первого входа локальное хранилище может быть пустым).
///
/// Живёт здесь (а не в `auth_interceptor.dart`, где раньше был объявлен),
/// потому что нужен и `AuthInterceptor`, и `TokenRefresher` — общая точка
/// без цикла импортов между этими двумя файлами.
typedef TokenReader = Future<Tokens?> Function();

/// Сохраняет новую пару токенов, полученную после успешного
/// `/auth/refresh`.
typedef TokenWriter = Future<void> Function(Tokens tokens);

/// Общая инфраструктура для всех модулей `SqApi`: HTTP-клиент и единая
/// обёртка ошибок, на которые опираются миксины модулей (`on SqApiBase`) —
/// auth/experts/requests/consultations/payments/notifications/tickets.
abstract class SqApiBase {
  Dio get dio;

  /// Выполняет [action]; любая ошибка превращается в [ApiException] — это
  /// контракт `SqApi`, на который опираются все последующие задачи (никакого
  /// сырого `DioException`/`TypeError` наружу).
  ///
  /// - [DioException] превращается через [ApiException.fromDioError]. Если
  ///   она уже нормализована выше по цепочке (см. `AuthInterceptor`, который
  ///   кладёт готовый [ApiException] в `DioException.error` при провале
  ///   рефреша), используется как есть — не заворачивается повторно.
  /// - Уже брошенный [ApiException] (в принципе не должен возникать внутри
  ///   [action] иначе как через `DioException.error`, но на всякий случай)
  ///   пробрасывается как есть, а не заворачивается ещё раз.
  /// - Любое другое исключение — например `TypeError` из сгенерированного
  ///   `fromJson`, если бэкенд вернул 200 с телом неожиданной формы —
  ///   заворачивается в [ApiErrorCode.internal]. Без этой ветки ошибка
  ///   разбора успешного ответа проходила бы мимо контракта сырым
  ///   Dart-исключением.
  Future<T> guard<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on DioException catch (e) {
      final error = e.error;
      if (error is ApiException) {
        throw error;
      }
      throw ApiException.fromDioError(e);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        ApiErrorCode.internal,
        'Не удалось обработать ответ сервера',
        0,
        e,
      );
    }
  }
}
