// Юнит-тесты центра уведомлений эксперта (Step 1 брифа задачи 16 эпика E7):
// бейдж непрочитанных, регистрация устройства при появлении сессии, повтор
// при смене языка — те же формы теста, что E6 задача 18.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_expert/core/locale_controller.dart';
import 'package:app_expert/core/push_token_source.dart';
import 'package:app_expert/features/auth/state/auth_controller.dart';
import 'package:app_expert/features/notifications/state/notifications_controller.dart';

class MockSqApi extends Mock implements SqApi {}

/// Управляемый тестом признак «сессия есть» — настоящий `hasSessionProvider`
/// считает его по `AuthController`, здесь важен только сам факт появления.
final _testHasSession = StateProvider<bool>((ref) => false);

class _FakeSqSocket implements SqSocket {
  final _events = StreamController<(String, dynamic)>.broadcast();

  @override
  Stream<(String, dynamic)> get events => _events.stream;

  @override
  Stream<SqConnectionState> get connectionState => const Stream.empty();

  @override
  void emit(String event, dynamic data) {}

  @override
  Future<void> connect(String token) async {}

  @override
  Future<void> disconnect() async {}

  Future<void> dispose() => _events.close();
}

class _FakePushTokenSource implements PushTokenSource {
  _FakePushTokenSource(this.value);

  final String? value;

  @override
  Future<String?> token() async => value;
}

AppNotification _notification(String id, {DateTime? readAt}) => AppNotification(
  id: id,
  type: 'offer.incoming',
  title: 'Новая заявка',
  body: 'Поступил новый оффер',
  data: const {},
  readAt: readAt,
  createdAt: DateTime(2026, 8, 25, 10),
);

Future<ProviderContainer> _container({
  required SqApi api,
  required SqSocket socket,
  PushTokenSource? pushTokens,
}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final container = ProviderContainer(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
      sharedPreferencesProvider.overrideWithValue(prefs),
      systemLocaleProvider.overrideWithValue(const Locale('ru')),
      if (pushTokens != null)
        pushTokenSourceProvider.overrideWithValue(pushTokens),
      hasSessionProvider.overrideWith((ref) => ref.watch(_testHasSession)),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  late MockSqApi api;
  late _FakeSqSocket socket;

  setUp(() {
    api = MockSqApi();
    socket = _FakeSqSocket();
    addTearDown(socket.dispose);
    when(
      () => api.notifications(
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer(
      (_) async => NotificationsPage(
        items: [_notification('n1'), _notification('n2')],
        unreadCount: 2,
      ),
    );
    when(
      () => api.registerDevice(
        platform: any(named: 'platform'),
        token: any(named: 'token'),
        locale: any(named: 'locale'),
      ),
    ).thenAnswer((_) async {});
  });

  testWidgets('первая страница кладёт счётчик непрочитанных', (tester) async {
    final container = await _container(api: api, socket: socket);
    container.listen(
      notificationsControllerProvider,
      (previous, next) {},
      fireImmediately: true,
    );
    await tester.pump();

    expect(container.read(unreadCountProvider), 2);
    container.dispose();
  });

  group('DeviceRegistrar', () {
    testWidgets('без push-токена запрос не уходит вовсе', (tester) async {
      final container = await _container(
        api: api,
        socket: socket,
        pushTokens: const NoopPushTokenSource(),
      );

      await container.read(deviceRegistrarProvider).register();

      verifyNever(
        () => api.registerDevice(
          platform: any(named: 'platform'),
          token: any(named: 'token'),
          locale: any(named: 'locale'),
        ),
      );

      container.dispose();
    });

    testWidgets('с токеном регистрируется один раз с платформой и локалью', (
      tester,
    ) async {
      final container = await _container(
        api: api,
        socket: socket,
        pushTokens: _FakePushTokenSource('abc'),
      );

      await container.read(deviceRegistrarProvider).register();

      verify(
        () => api.registerDevice(
          platform: any(named: 'platform', that: isIn(['android', 'ios'])),
          token: 'abc',
          locale: 'ru',
        ),
      ).called(1);

      container.dispose();
    });

    testWidgets('смена языка перерегистрирует устройство', (tester) async {
      final container = await _container(
        api: api,
        socket: socket,
        pushTokens: _FakePushTokenSource('abc'),
      );
      await container.read(deviceRegistrarProvider).register();
      clearInteractions(api);

      await container
          .read(localeControllerProvider.notifier)
          .setLocale(const Locale('kk'));
      await tester.pump();

      verify(
        () => api.registerDevice(
          platform: any(named: 'platform'),
          token: 'abc',
          locale: 'kz',
        ),
      ).called(1);

      container.dispose();
    });

    testWidgets('появление сессии запускает регистрацию ровно один раз', (
      tester,
    ) async {
      final container = await _container(
        api: api,
        socket: socket,
        pushTokens: _FakePushTokenSource('abc'),
      );
      container.listen(
        deviceRegistrationProvider,
        (previous, next) {},
        fireImmediately: true,
      );

      container.read(_testHasSession.notifier).state = true;
      await tester.pumpAndSettle();
      // Повторное «то же самое» состояние второй регистрации не даёт.
      container.read(_testHasSession.notifier).state = true;
      await tester.pumpAndSettle();

      verify(
        () => api.registerDevice(
          platform: any(named: 'platform'),
          token: 'abc',
          locale: 'ru',
        ),
      ).called(1);

      container.dispose();
    });

    testWidgets('сбой регистрации не бросает наружу', (tester) async {
      when(
        () => api.registerDevice(
          platform: any(named: 'platform'),
          token: any(named: 'token'),
          locale: any(named: 'locale'),
        ),
      ).thenAnswer(
        (_) async =>
            throw const ApiException(ApiErrorCode.network, 'нет сети', 0),
      );

      final container = await _container(
        api: api,
        socket: socket,
        pushTokens: _FakePushTokenSource('abc'),
      );

      await expectLater(
        container.read(deviceRegistrarProvider).register(),
        completes,
      );

      container.dispose();
    });
  });
}
