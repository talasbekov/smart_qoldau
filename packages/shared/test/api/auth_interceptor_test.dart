import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/api/sq_api_auth.dart';
import 'package:shared/api/sq_api_base.dart';
import 'package:shared/shared.dart';

/// Обёртка над `read`/`write`/`onLogout`, чтобы их можно было мокать
/// mocktail'ом (сами по себе typedef-функции мокать нечем).
abstract class TokenGateway {
  Future<Tokens?> read();
  Future<void> write(Tokens tokens);
  Future<void> onLogout();
}

class MockTokenGateway extends Mock implements TokenGateway {}

/// Минимальный носитель `SqApiAuth.refresh` для теста — ровно то же самое,
/// что `SqApi` собирает сам себе внутри своего конструктора: `TokenRefresher`
/// не переизобретает запрос `POST /auth/refresh`, а зовёт его через ЭТОТ
/// метод, поэтому тест использует ровно ту же реализацию, что и прод.
class _RefreshOnly extends SqApiBase with SqApiAuth {
  _RefreshOnly(this.dio);

  @override
  final Dio dio;
}

Tokens _tokens(String access, String refresh) => Tokens(
      accessToken: access,
      refreshToken: refresh,
      user: const AuthUser(id: 'u1', phone: '+77011234567', isGuest: false),
    );

Map<String, dynamic> _tokensJson(String access, String refresh) => {
      'accessToken': access,
      'refreshToken': refresh,
      'user': {'id': 'u1', 'phone': '+77011234567', 'isGuest': false},
    };

Map<String, dynamic> _unauthorizedBody() => {
      'error': {'code': 'UNAUTHORIZED', 'message': 'expired'},
    };

void main() {
  setUpAll(() {
    registerFallbackValue(_tokens('fallback-access', 'fallback-refresh'));
  });

  late Dio dio;
  late DioAdapter adapter;
  late MockTokenGateway gateway;
  late Tokens currentTokens;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'https://api.test.local/v1'));
    adapter = DioAdapter(dio: dio);
    gateway = MockTokenGateway();
    currentTokens = _tokens('old-access', 'old-refresh');

    when(() => gateway.read()).thenAnswer((_) async => currentTokens);
    when(() => gateway.write(any())).thenAnswer((invocation) async {
      currentTokens = invocation.positionalArguments[0] as Tokens;
    });
    when(() => gateway.onLogout()).thenAnswer((_) async {});

    // Конструктор сам добавляет себя в dio.interceptors — раньше был
    // отдельный `.attach(dio)`, который можно было забыть вызвать (тогда
    // интерцептор выглядел рабочим, но 401 просто проходил мимо).
    final refresher = TokenRefresher(
      gateway.read,
      gateway.write,
      _RefreshOnly(dio).refresh,
    );
    AuthInterceptor(dio, gateway.read, refresher, gateway.onLogout);
  });

  test('refreshes once on 401 and retries the original request with the new token', () async {
    adapter
      ..onGet(
        '/consultations',
        (server) => server.reply(401, _unauthorizedBody()),
        headers: {'Authorization': 'Bearer old-access'},
      )
      ..onGet(
        '/consultations',
        (server) => server.reply(200, <dynamic>[]),
        headers: {'Authorization': 'Bearer new-access'},
      )
      ..onPost(
        '/auth/refresh',
        (server) => server.reply(200, _tokensJson('new-access', 'new-refresh')),
        data: Matchers.any,
      );

    final response = await dio.get<List<dynamic>>('/consultations');

    expect(response.statusCode, 200);
    verify(() => gateway.write(any())).called(1);
    expect(currentTokens.accessToken, 'new-access');
  });

  test('two parallel 401s share exactly one refresh call', () async {
    var refreshCalls = 0;
    adapter
      ..onGet(
        '/consultations',
        (server) => server.reply(
          401,
          _unauthorizedBody(),
          delay: const Duration(milliseconds: 5),
        ),
        headers: {'Authorization': 'Bearer old-access'},
      )
      ..onGet(
        '/notifications',
        (server) => server.reply(
          401,
          _unauthorizedBody(),
          delay: const Duration(milliseconds: 5),
        ),
        headers: {'Authorization': 'Bearer old-access'},
      )
      ..onGet(
        '/consultations',
        (server) => server.reply(200, <dynamic>[]),
        headers: {'Authorization': 'Bearer new-access'},
      )
      ..onGet(
        '/notifications',
        (server) => server.reply(200, {'items': <dynamic>[], 'unreadCount': 0}),
        headers: {'Authorization': 'Bearer new-access'},
      )
      ..onPost(
        '/auth/refresh',
        (server) => server.replyCallback(
          200,
          (options) {
            refreshCalls++;
            return _tokensJson('new-access', 'new-refresh');
          },
          delay: const Duration(milliseconds: 20),
        ),
        data: Matchers.any,
      );

    final responses = await Future.wait([
      dio.get<List<dynamic>>('/consultations'),
      dio.get<Map<String, dynamic>>('/notifications'),
    ]);

    expect(responses[0].statusCode, 200);
    expect(responses[1].statusCode, 200);
    expect(refreshCalls, 1, reason: 'два параллельных 401 должны были вызвать ровно один рефреш');
  });

  test('logs out and does not retry when the refresh call itself fails', () async {
    adapter
      ..onGet(
        '/consultations',
        (server) => server.reply(401, _unauthorizedBody()),
        headers: {'Authorization': 'Bearer old-access'},
      )
      ..onPost(
        '/auth/refresh',
        (server) => server.reply(401, _unauthorizedBody()),
        data: Matchers.any,
      );

    await expectLater(
      dio.get<List<dynamic>>('/consultations'),
      throwsA(
        isA<DioException>().having(
          (e) => e.error,
          'error',
          isA<ApiException>().having((e) => e.code, 'code', 'UNAUTHORIZED'),
        ),
      ),
    );

    verify(() => gateway.onLogout()).called(1);
    verifyNever(() => gateway.write(any()));
  });

  test('refresh succeeds but the retry itself fails with 500 — no logout, the real error propagates', () async {
    adapter
      ..onGet(
        '/consultations',
        (server) => server.reply(401, _unauthorizedBody()),
        headers: {'Authorization': 'Bearer old-access'},
      )
      ..onGet(
        '/consultations',
        (server) => server.reply(500, {
          'error': {'code': 'INTERNAL', 'message': 'boom'},
        }),
        headers: {'Authorization': 'Bearer new-access'},
      )
      ..onPost(
        '/auth/refresh',
        (server) => server.reply(200, _tokensJson('new-access', 'new-refresh')),
        data: Matchers.any,
      );

    await expectLater(
      dio.get<List<dynamic>>('/consultations'),
      throwsA(
        isA<DioException>().having(
          (e) => e.response?.statusCode,
          'response.statusCode',
          500,
        ),
      ),
    );

    // Рефреш прошёл успешно (новый токен получен и сохранён) — упал именно
    // повторный запрос по своей причине, это не повод разлогинивать.
    verify(() => gateway.write(any())).called(1);
    verifyNever(() => gateway.onLogout());
  });

  test('refresh succeeds but the retry itself fails with 403 — no logout, the real error propagates', () async {
    adapter
      ..onGet(
        '/consultations',
        (server) => server.reply(401, _unauthorizedBody()),
        headers: {'Authorization': 'Bearer old-access'},
      )
      ..onGet(
        '/consultations',
        (server) => server.reply(403, {
          'error': {'code': 'FORBIDDEN', 'message': 'not yours'},
        }),
        headers: {'Authorization': 'Bearer new-access'},
      )
      ..onPost(
        '/auth/refresh',
        (server) => server.reply(200, _tokensJson('new-access', 'new-refresh')),
        data: Matchers.any,
      );

    await expectLater(
      dio.get<List<dynamic>>('/consultations'),
      throwsA(
        isA<DioException>().having(
          (e) => e.response?.statusCode,
          'response.statusCode',
          403,
        ),
      ),
    );

    verify(() => gateway.write(any())).called(1);
    verifyNever(() => gateway.onLogout());
  });

  test('does not intercept 401s coming from /auth/* paths (no recursive refresh)', () async {
    adapter.onPost(
      '/auth/verify-code',
      (server) => server.reply(401, _unauthorizedBody()),
      data: Matchers.any,
    );

    await expectLater(
      dio.post<Map<String, dynamic>>(
        '/auth/verify-code',
        data: {'phone': '+77011234567', 'code': '0000'},
      ),
      throwsA(isA<DioException>()),
    );

    verifyNever(() => gateway.onLogout());
    verifyNever(() => gateway.write(any()));
  });
}
