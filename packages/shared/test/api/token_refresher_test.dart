// Юнит-тест TokenRefresher — единственного владельца обновления токенов
// сессии (задача 8 эпика E6, раунд правок 2: до этого класса
// AuthInterceptor и шина реалтайм-событий гонялись за один и тот же
// одноразовый refresh-токен независимо друг от друга).
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

Tokens _tokens(String access, String refresh) => Tokens(
  accessToken: access,
  refreshToken: refresh,
  user: AuthUser(id: 'u1', phone: null, isGuest: true),
);

void main() {
  group('TokenRefresher', () {
    test('читает текущий refresh-токен, вызывает refreshCall и пишет результат', () async {
      var current = _tokens('old-access', 'old-refresh');
      final calls = <String>[];
      final refresher = TokenRefresher(
        () async => current,
        (tokens) async => current = tokens,
        (refreshToken) async {
          calls.add(refreshToken);
          return _tokens('new-access', 'new-refresh');
        },
      );

      final result = await refresher.refresh();

      expect(calls, ['old-refresh']);
      expect(result.accessToken, 'new-access');
      expect(current.accessToken, 'new-access', reason: 'результат должен быть записан через writer');
    });

    test(
      'параллельные вызовы refresh() делят один и тот же refreshCall '
      '(single-flight)',
      () async {
        var current = _tokens('old-access', 'old-refresh');
        var refreshCallCount = 0;
        final gate = Completer<void>();
        final refresher = TokenRefresher(
          () async => current,
          (tokens) async => current = tokens,
          (refreshToken) async {
            refreshCallCount++;
            await gate.future;
            return _tokens('new-access', 'new-refresh');
          },
        );

        final first = refresher.refresh();
        final second = refresher.refresh();
        await pumpEventQueue();
        expect(
          refreshCallCount,
          1,
          reason: 'второй refresh() не должен запускать собственный refreshCall',
        );

        gate.complete();
        final results = await Future.wait([first, second]);

        expect(refreshCallCount, 1);
        expect(results[0].accessToken, 'new-access');
        expect(results[1].accessToken, 'new-access');
        expect(
          identical(first, second),
          isTrue,
          reason: 'второй вызов получает ТОТ ЖЕ Future первого — не запускает параллельный',
        );
      },
    );

    test('после завершения обновления следующий refresh() запускает новый refreshCall', () async {
      var current = _tokens('old-access', 'old-refresh');
      var refreshCallCount = 0;
      final refresher = TokenRefresher(
        () async => current,
        (tokens) async => current = tokens,
        (refreshToken) async {
          refreshCallCount++;
          return _tokens('access-$refreshCallCount', 'refresh-$refreshCallCount');
        },
      );

      await refresher.refresh();
      await refresher.refresh();

      expect(
        refreshCallCount,
        2,
        reason: '_inFlight обязан очищаться после завершения — иначе второй '
            'вызов навсегда получал бы устаревший первый результат',
      );
    });

    test('провал refreshCall пробрасывается вызывающему и НЕ пишет токены', () async {
      var writeCalls = 0;
      final refresher = TokenRefresher(
        () async => _tokens('old-access', 'old-refresh'),
        (_) async => writeCalls++,
        (_) async => throw const ApiException(
          ApiErrorCode.unauthorized,
          'рефреш-токен мёртв',
          401,
        ),
      );

      await expectLater(
        refresher.refresh(),
        throwsA(isA<ApiException>()),
      );
      expect(writeCalls, 0);
    });

    test(
      'после провала следующий refresh() пробует снова, а не застревает '
      'на отклонённом _inFlight',
      () async {
        var attempt = 0;
        final refresher = TokenRefresher(
          () async => _tokens('old-access', 'old-refresh'),
          (_) async {},
          (_) async {
            attempt++;
            if (attempt == 1) {
              throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
            }
            return _tokens('new-access', 'new-refresh');
          },
        );

        await expectLater(refresher.refresh(), throwsA(isA<ApiException>()));
        final result = await refresher.refresh();

        expect(attempt, 2);
        expect(result.accessToken, 'new-access');
      },
    );
  });
}
