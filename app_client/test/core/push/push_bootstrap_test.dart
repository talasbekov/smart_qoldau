// Тесты пуш-канала (Step 1 брифа задачи 22): при выключенном флаге —
// ни одного обращения к Firebase; при включённом — разрешение, токен,
// регистрация устройства, перерегистрация при смене токена и переходы по
// дип-линку из пуша.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/core/providers.dart';
import 'package:app_client/core/push/push_bootstrap.dart';
import 'package:app_client/core/push/push_config.dart';
import 'package:app_client/core/push/push_messaging_port.dart';
import 'package:app_client/core/push_token_source.dart';

class MockSqApi extends Mock implements SqApi {}

/// Фейковый порт Firebase: тест решает, что вернёт разрешение и токен, и
/// сам присылает сообщения. Настоящая реализация ходит в платформенные
/// каналы, которых в headless-тесте нет.
class _FakeMessagingPort implements PushMessagingPort {
  _FakeMessagingPort({this.granted = true, this.initialToken = 'token-1'});

  final bool granted;
  final String? initialToken;

  int permissionRequests = 0;
  int initCalls = 0;
  final _tokenRefresh = StreamController<String>.broadcast();
  final _foreground = StreamController<PushMessage>.broadcast();
  final _opened = StreamController<PushMessage>.broadcast();
  PushMessage? initialMessage;

  @override
  Future<void> initialize() async => initCalls++;

  @override
  Future<bool> requestPermission() async {
    permissionRequests++;
    return granted;
  }

  @override
  Future<String?> token() async => initialToken;

  @override
  Stream<String> get tokenRefresh => _tokenRefresh.stream;

  @override
  Stream<PushMessage> get onForegroundMessage => _foreground.stream;

  @override
  Stream<PushMessage> get onMessageOpened => _opened.stream;

  @override
  Future<PushMessage?> takeInitialMessage() async => initialMessage;

  void refreshToken(String token) => _tokenRefresh.add(token);

  void pushForeground(PushMessage message) => _foreground.add(message);

  void openMessage(PushMessage message) => _opened.add(message);

  Future<void> dispose() async {
    await _tokenRefresh.close();
    await _foreground.close();
    await _opened.close();
  }
}

/// Куда «переходило» приложение и что показывало локально.
class _Recorder {
  final List<String> routes = [];
  final List<PushMessage> localNotifications = [];
}

Future<ProviderContainer> _container({
  required SqApi api,
  required PushMessagingPort port,
  required bool configured,
  required _Recorder recorder,
}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final container = ProviderContainer(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sharedPreferencesProvider.overrideWithValue(prefs),
      systemLocaleProvider.overrideWithValue(const Locale('ru')),
      pushConfigProvider.overrideWithValue(PushConfig(enabled: configured)),
      pushMessagingPortProvider.overrideWithValue(port),
      pushNavigatorProvider.overrideWithValue(recorder.routes.add),
      localNotificationPresenterProvider.overrideWithValue(
        recorder.localNotifications.add,
      ),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

PushMessage _chatMessage() => const PushMessage(
  title: 'Психолог ответил',
  body: 'Новое сообщение',
  data: {'type': 'chat.message', 'consultationId': 'c1'},
);

void main() {
  late MockSqApi api;
  late _FakeMessagingPort port;
  late _Recorder recorder;

  setUp(() {
    api = MockSqApi();
    port = _FakeMessagingPort();
    recorder = _Recorder();
    addTearDown(port.dispose);
    when(
      () => api.registerDevice(
        platform: any(named: 'platform'),
        token: any(named: 'token'),
        locale: any(named: 'locale'),
      ),
    ).thenAnswer((_) async {});
  });

  test('при выключенном флаге Firebase не трогается вовсе', () async {
    final container = await _container(
      api: api,
      port: port,
      configured: false,
      recorder: recorder,
    );

    await container.read(pushBootstrapProvider).init();

    expect(port.initCalls, 0);
    expect(port.permissionRequests, 0);
    verifyNever(
      () => api.registerDevice(
        platform: any(named: 'platform'),
        token: any(named: 'token'),
        locale: any(named: 'locale'),
      ),
    );
    // И источник токена остаётся no-op: устройство не регистрируется.
    expect(await container.read(pushTokenSourceProvider).token(), isNull);
  });

  test('при включённом флаге спрашивает разрешение и регистрирует токен', () async {
    final container = await _container(
      api: api,
      port: port,
      configured: true,
      recorder: recorder,
    );

    await container.read(pushBootstrapProvider).init();

    expect(port.initCalls, 1);
    expect(port.permissionRequests, 1);
    verify(
      () => api.registerDevice(
        platform: any(named: 'platform'),
        token: 'token-1',
        locale: 'ru',
      ),
    ).called(1);
  });

  test('пустой токен не отправляется на бэкенд', () async {
    // Токена может не быть (устройство без Google Play Services,
    // отозванное разрешение) — пустая запись в `devices` бэкенду не нужна.
    port = _FakeMessagingPort(initialToken: null);
    addTearDown(port.dispose);

    final container = await _container(
      api: api,
      port: port,
      configured: true,
      recorder: recorder,
    );

    await container.read(pushBootstrapProvider).init();

    verifyNever(
      () => api.registerDevice(
        platform: any(named: 'platform'),
        token: any(named: 'token'),
        locale: any(named: 'locale'),
      ),
    );
  });

  test('отказ в разрешении не мешает работе приложения и токен не шлётся', () async {
    port = _FakeMessagingPort(granted: false);
    addTearDown(port.dispose);

    final container = await _container(
      api: api,
      port: port,
      configured: true,
      recorder: recorder,
    );

    await container.read(pushBootstrapProvider).init();

    verifyNever(
      () => api.registerDevice(
        platform: any(named: 'platform'),
        token: any(named: 'token'),
        locale: any(named: 'locale'),
      ),
    );
  });

  test('смена токена перерегистрирует устройство новым значением', () async {
    final container = await _container(
      api: api,
      port: port,
      configured: true,
      recorder: recorder,
    );
    await container.read(pushBootstrapProvider).init();
    clearInteractions(api);

    port.refreshToken('token-2');
    await Future<void>.delayed(Duration.zero);

    verify(
      () => api.registerDevice(
        platform: any(named: 'platform'),
        token: 'token-2',
        locale: 'ru',
      ),
    ).called(1);
  });

  test('пуш, открытый из фона, ведёт по тому же дип-линку, что и тайл', () async {
    final container = await _container(
      api: api,
      port: port,
      configured: true,
      recorder: recorder,
    );
    await container.read(pushBootstrapProvider).init();

    port.openMessage(_chatMessage());
    await Future<void>.delayed(Duration.zero);

    expect(recorder.routes, ['/session/c1']);
  });

  test('холодный старт из пуша тоже даёт переход', () async {
    port.initialMessage = _chatMessage();

    final container = await _container(
      api: api,
      port: port,
      configured: true,
      recorder: recorder,
    );
    await container.read(pushBootstrapProvider).init();

    expect(recorder.routes, ['/session/c1']);
  });

  test('пуш в форграунде НЕ навигирует, а показывает локальное уведомление', () async {
    // Уводить человека с открытого экрана (например, из чата или звонка)
    // из-за входящего пуша нельзя — это и есть разница между «пришло» и
    // «пользователь нажал».
    final container = await _container(
      api: api,
      port: port,
      configured: true,
      recorder: recorder,
    );
    await container.read(pushBootstrapProvider).init();

    port.pushForeground(_chatMessage());
    await Future<void>.delayed(Duration.zero);

    expect(recorder.routes, isEmpty);
    expect(recorder.localNotifications.length, 1);
    expect(recorder.localNotifications.single.title, 'Психолог ответил');
  });

  test('пуш без известного типа не роняет обработку и никуда не ведёт', () async {
    final container = await _container(
      api: api,
      port: port,
      configured: true,
      recorder: recorder,
    );
    await container.read(pushBootstrapProvider).init();

    port.openMessage(
      const PushMessage(
        title: 'Что-то новое',
        body: 'Текст',
        data: {'type': 'payout.updated'},
      ),
    );
    await Future<void>.delayed(Duration.zero);

    expect(recorder.routes, isEmpty);
  });
}
