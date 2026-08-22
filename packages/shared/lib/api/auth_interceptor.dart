import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api_exception.dart';

/// Читает текущую пару токенов, либо `null`, если пользователь ещё не вошёл
/// (гость без токенов вообще не бывает — гостевой вход тоже выдаёт [Tokens],
/// но до первого входа локальное хранилище может быть пустым).
typedef TokenReader = Future<Tokens?> Function();

/// Сохраняет новую пару токенов, полученную после успешного
/// `/auth/refresh`.
typedef TokenWriter = Future<void> Function(Tokens tokens);

/// Ключ [RequestOptions.extra], которым помечается уже повторённый после
/// рефреша запрос — не даёт уйти в повторный цикл, если и сам повтор снова
/// вернёт 401.
const _retriedAfterRefreshKey = 'sqAuthRetriedAfterRefresh';

/// Подставляет `Authorization: Bearer <access>` во все запросы и разруливает
/// протухший access-токен: на 401 обновляет пару токенов через
/// `/auth/refresh` и повторяет исходный запрос ровно один раз.
///
/// Запросы к `/auth/*` не проходят через 401-логику обновления токена —
/// иначе ответ 401 от самого `/auth/refresh` (просроченный refresh-токен)
/// запустил бы новый рефреш и ушёл в рекурсию. Токен в заголовок им всё
/// равно подставляется (он нужен `/auth/guest/convert`) — не обрабатывается
/// только именно эта recovery-логика.
///
/// Параллельные 401 от нескольких запросов используют один и тот же вызов
/// рефреша ([_refreshInFlight]) — single-flight: пока первый рефреш не
/// завершился, второй его не дублирует, а ждёт тот же `Future`.
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._read, this._write, this._onLogout);

  final TokenReader _read;
  final TokenWriter _write;
  final Future<void> Function() _onLogout;

  Dio? _dio;
  Future<Tokens>? _refreshInFlight;

  /// Прикрепляет интерцептор к [dio] и запоминает клиент — он нужен, чтобы
  /// самому вызвать `/auth/refresh` и повторить исходный запрос тем же
  /// адаптером (в частности, мок-адаптером в тестах), а не поднимать для
  /// этого отдельный сетевой стек.
  void attach(Dio dio) {
    _dio = dio;
    dio.interceptors.add(this);
  }

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final tokens = await _read();
    if (tokens != null) {
      options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    final isAuthPath = options.path.startsWith('/auth/');
    final alreadyRetried = options.extra[_retriedAfterRefreshKey] == true;
    final dio = _dio;

    if (isAuthPath || alreadyRetried || dio == null || err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    try {
      final tokens = await _refresh(dio);
      final retryOptions = options.copyWith(
        headers: {
          ...options.headers,
          'Authorization': 'Bearer ${tokens.accessToken}',
        },
        extra: {...options.extra, _retriedAfterRefreshKey: true},
      );
      final response = await dio.fetch<dynamic>(retryOptions);
      handler.resolve(response);
    } catch (_) {
      await _onLogout();
      handler.reject(
        DioException(
          requestOptions: options,
          error: const ApiException(
            ApiErrorCode.unauthorized,
            'Сессия истекла, войдите заново',
            401,
          ),
        ),
      );
    }
  }

  Future<Tokens> _refresh(Dio dio) {
    return _refreshInFlight ??= _doRefresh(dio).whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<Tokens> _doRefresh(Dio dio) async {
    final current = await _read();
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': current?.refreshToken},
    );
    final tokens = Tokens.fromJson(response.data!);
    await _write(tokens);
    return tokens;
  }
}
