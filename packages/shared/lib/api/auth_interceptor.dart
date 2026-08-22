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
  /// Создаёт интерцептор и сразу же подключает его к [dio] —
  /// конструирование и подключение намеренно не разделены отдельным
  /// методом (раньше был `attach(dio)`). Раздельные шаги можно забыть
  /// выполнить: интерцептор создаётся, `onRequest` как будто бы работает
  /// (если создать его по ошибке ещё раз и подставлять токен вручную), но
  /// `onError` никогда не вызывается — 401 тихо проходит мимо без рефреша,
  /// без ошибки и без предупреждения. Конструктор, который сам себя
  /// регистрирует в `dio.interceptors`, эту ошибку делает невозможной.
  AuthInterceptor(this._dio, this._read, this._write, this._onLogout) {
    _dio.interceptors.add(this);
  }

  final Dio _dio;
  final TokenReader _read;
  final TokenWriter _write;
  final Future<void> Function() _onLogout;

  Future<Tokens>? _refreshInFlight;

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

    if (isAuthPath || alreadyRetried || err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    // Два независимых шага с разными последствиями провала — намеренно два
    // отдельных try/catch, а не один общий:
    // 1. Рефреш не удался -> сессия действительно мертва -> onLogout и
    //    единый синтетический ApiException('UNAUTHORIZED').
    // 2. Рефреш удался, но повтор исходного запроса упал по СВОЕЙ причине
    //    (403 на конкретный ресурс, 500, обрыв сети) -> сессия рабочая,
    //    разлогинивать не за что — наружу должна уйти НАСТОЯЩАЯ ошибка
    //    этого запроса, а не выдуманная UNAUTHORIZED.
    final Tokens tokens;
    try {
      tokens = await _refresh(_dio);
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
      return;
    }

    final retryOptions = options.copyWith(
      headers: {
        ...options.headers,
        'Authorization': 'Bearer ${tokens.accessToken}',
      },
      extra: {...options.extra, _retriedAfterRefreshKey: true},
    );
    try {
      final response = await _dio.fetch<dynamic>(retryOptions);
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
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
