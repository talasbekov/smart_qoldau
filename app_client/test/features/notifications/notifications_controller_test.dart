// Юнит-тесты центра уведомлений (Step 1 брифа задачи 18): счётчик
// непрочитанных, отметка прочтения, дебаунс реалтайм-события и регистрация
// устройства только при наличии push-токена.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/core/providers.dart';
import 'package:app_client/core/push_token_source.dart';
import 'package:app_client/features/auth/state/auth_controller.dart';
import 'package:app_client/features/notifications/state/notifications_controller.dart';

class MockSqApi extends Mock implements SqApi {}

/// Управляемый тестом признак «сессия есть»: настоящий
/// `hasSessionProvider` считает его по `AuthController`, а здесь важно
/// только само появление сессии.
final _testHasSession = StateProvider<bool>((ref) => false);

class _FakeSqSocket implements SqSocket {
  final _events = StreamController<(String, dynamic)>.broadcast();

  void push(String event, dynamic data) => _events.add((event, data));

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

/// Источник push-токена, который возвращает то, что задал тест.
class _FakePushTokenSource implements PushTokenSource {
  _FakePushTokenSource(this.value);

  final String? value;

  @override
  Future<String?> token() async => value;
}

AppNotification _notification(String id, {DateTime? readAt}) => AppNotification(
  id: id,
  type: 'chat.message',
  title: 'Новое сообщение',
  body: 'Психолог ответил',
  data: const {'consultationId': 'c1'},
  readAt: readAt,
  createdAt: DateTime(2026, 8, 22, 10),
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
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer(
      (_) async => NotificationsPage(
        items: [_notification('n1'), _notification('n2')],
        unreadCount: 2,
      ),
    );
    when(
      () => api.markNotificationsRead(ids: any(named: 'ids')),
    ).thenAnswer((_) async {});
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

    final state = await container.read(notificationsControllerProvider.future);

    expect(state.items.length, 2);
    expect(state.unreadCount, 2);
    expect(container.read(unreadCountProvider), 2);

    container.dispose();
  });

  testWidgets('markRead помечает запись и уменьшает счётчик', (tester) async {
    final container = await _container(api: api, socket: socket);
    container.listen(
      notificationsControllerProvider,
      (previous, next) {},
      fireImmediately: true,
    );
    await container.read(notificationsControllerProvider.future);

    await container
        .read(notificationsControllerProvider.notifier)
        .markRead(['n1']);

    final state = container.read(notificationsControllerProvider).requireValue;
    verify(() => api.markNotificationsRead(ids: ['n1'])).called(1);
    expect(state.items.firstWhere((n) => n.id == 'n1').readAt, isNotNull);
    expect(state.unreadCount, 1);

    container.dispose();
  });

  testWidgets('markAllRead шлёт запрос БЕЗ ids и обнуляет счётчик', (
    tester,
  ) async {
    // По контракту бэкенда пустой/отсутствующий `ids` означает «все свои»;
    // передать пустой список значило бы «ни одного».
    final container = await _container(api: api, socket: socket);
    container.listen(
      notificationsControllerProvider,
      (previous, next) {},
      fireImmediately: true,
    );
    await container.read(notificationsControllerProvider.future);

    await container.read(notificationsControllerProvider.notifier).markAllRead();

    verify(() => api.markNotificationsRead(ids: null)).called(1);
    final state = container.read(notificationsControllerProvider).requireValue;
    expect(state.unreadCount, 0);
    expect(state.items.every((n) => n.readAt != null), isTrue);

    container.dispose();
  });

  testWidgets('серия событий за 500 мс даёт ровно один перезапрос', (
    tester,
  ) async {
    final container = await _container(api: api, socket: socket);
    container.listen(
      notificationsControllerProvider,
      (previous, next) {},
      fireImmediately: true,
    );
    await container.read(notificationsControllerProvider.future);
    clearInteractions(api);

    socket.push('notification.new', {'id': 'n3', 'type': 'chat.message'});
    socket.push('notification.new', {'id': 'n4', 'type': 'chat.message'});
    socket.push('notification.new', {'id': 'n5', 'type': 'chat.message'});
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();

    verify(
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).called(1);

    container.dispose();
  });

  testWidgets('пагинация дописывает вторую страницу без дублей', (
    tester,
  ) async {
    when(() => api.notifications(take: any(named: 'take'), skip: 0)).thenAnswer(
      (_) async =>
          NotificationsPage(items: [_notification('n1')], unreadCount: 1),
    );
    when(() => api.notifications(take: any(named: 'take'), skip: 1)).thenAnswer(
      (_) async => NotificationsPage(
        items: [_notification('n1'), _notification('n2')],
        unreadCount: 1,
      ),
    );

    final container = await _container(api: api, socket: socket);
    container.listen(
      notificationsControllerProvider,
      (previous, next) {},
      fireImmediately: true,
    );
    await container.read(notificationsControllerProvider.future);

    await container.read(notificationsControllerProvider.notifier).loadMore();

    expect(
      container
          .read(notificationsControllerProvider)
          .requireValue
          .items
          .map((n) => n.id),
      ['n1', 'n2'],
    );

    container.dispose();
  });

  group('регистрация устройства', () {
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
      // Регистрация требует JWT: до входа `POST /devices` ответил бы 401,
      // поэтому её запускает появление сессии, а не старт приложения.
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
      // Регистрация асинхронна (сначала токен, потом запрос) — даём циклу
      // событий доработать до конца, а не один кадр.
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
      // Устройство не зарегистрировалось — это фон, а не пользовательская
      // операция: экран запуска не должен из-за этого падать.
      when(
        () => api.registerDevice(
          platform: any(named: 'platform'),
          token: any(named: 'token'),
          locale: any(named: 'locale'),
        ),
      ).thenAnswer(
        (_) async => throw const ApiException(ApiErrorCode.network, 'нет сети', 0),
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
