// Тесты пуш-канала (Step 1 брифа задачи 22, перенесены в `shared` задачей 2
// эпика E7): при выключенном флаге — ни одного обращения к Firebase; при
// включённом — разрешение, токен, регистрация устройства, перерегистрация
// при смене токена и переходы по дип-линку из пуша.
//
// Задача 2 (E7), осознанное отклонение от «тест переезжает 1:1 без
// изменения содержимого»: `PushBootstrap` в `app_client` регистрировал
// устройство через `deviceRegistrarProvider` (знает про локаль/платформу
// приложения) и резолвил маршрут через `notificationRoute()` (знает про
// `RoutePaths` конкретного приложения) — оба app_client-специфичны и не
// могут жить в `shared` без нарушения слоёв (`shared` не должен знать про
// `app_client`). Задача расширила уже существующий в файле паттерн заглушек
// (`pushNavigatorProvider`, `localNotificationPresenterProvider`) двумя
// новыми seam-провайдерами — `deviceTokenRegistrarProvider` (транспортный
// уровень: «вызвать API регистрации токена») и `pushRouteResolverProvider`
// (сигнатура зависит только от данных пуша, не от путей роутера). Раз сама
// архитектура файла изменилась (а не только путь импорта), этот тест
// переписан на фейки этих seam'ов вместо опоры на реальные
// `RoutePaths`/`DeviceRegistrar` из app_client — исключение согласовано
// явно, см. отчёт задачи 2.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

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

/// Куда «переходило» приложение, что показывало локально и какие токены
/// «зарегистрировало» — фейки seam-провайдеров пишут сюда.
class _Recorder {
  final List<String> routes = [];
  final List<PushMessage> localNotifications = [];
  final List<String> registeredTokens = [];
}

/// Тестовый резолвер маршрута — минимальная замена `notificationRoute()`
/// приложения: `chat.message` с `consultationId` ведёт в сессию, остальное
/// никуда. Проверяет ровно то, что `PushBootstrap` обязан сделать сам
/// (собрать `AppNotification` из `PushMessage` и спросить у seam'а маршрут),
/// а не конкретную таблицу маршрутов приложения.
String? _fakeRouteResolver(AppNotification notification) {
  if (notification.type != 'chat.message') return null;
  final consultationId = notification.data['consultationId'];
  return consultationId is String ? '/session/$consultationId' : null;
}

ProviderContainer _container({
  required PushMessagingPort port,
  required bool configured,
  required _Recorder recorder,
}) {
  final container = ProviderContainer(
    overrides: [
      pushConfigProvider.overrideWithValue(PushConfig(enabled: configured)),
      pushMessagingPortProvider.overrideWithValue(port),
      pushNavigatorProvider.overrideWithValue(recorder.routes.add),
      localNotificationPresenterProvider.overrideWithValue(
        recorder.localNotifications.add,
      ),
      deviceTokenRegistrarProvider.overrideWithValue(
        (token) async => recorder.registeredTokens.add(token),
      ),
      pushRouteResolverProvider.overrideWithValue(_fakeRouteResolver),
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
  late _FakeMessagingPort port;
  late _Recorder recorder;

  setUp(() {
    port = _FakeMessagingPort();
    recorder = _Recorder();
    addTearDown(port.dispose);
  });

  test('при выключенном флаге Firebase не трогается вовсе', () async {
    final container = _container(
      port: port,
      configured: false,
      recorder: recorder,
    );

    await container.read(pushBootstrapProvider).init();

    expect(port.initCalls, 0);
    expect(port.permissionRequests, 0);
    expect(recorder.registeredTokens, isEmpty);
  });

  test(
    'при включённом флаге спрашивает разрешение и регистрирует токен',
    () async {
      final container = _container(
        port: port,
        configured: true,
        recorder: recorder,
      );

      await container.read(pushBootstrapProvider).init();

      expect(port.initCalls, 1);
      expect(port.permissionRequests, 1);
      expect(recorder.registeredTokens, ['token-1']);
    },
  );

  test('пустой токен не отправляется на бэкенд', () async {
    // Токена может не быть (устройство без Google Play Services,
    // отозванное разрешение) — пустая запись в `devices` бэкенду не нужна.
    port = _FakeMessagingPort(initialToken: null);
    addTearDown(port.dispose);

    final container = _container(
      port: port,
      configured: true,
      recorder: recorder,
    );

    await container.read(pushBootstrapProvider).init();

    expect(recorder.registeredTokens, isEmpty);
  });

  test(
    'отказ в разрешении не мешает работе приложения и токен не шлётся',
    () async {
      port = _FakeMessagingPort(granted: false);
      addTearDown(port.dispose);

      final container = _container(
        port: port,
        configured: true,
        recorder: recorder,
      );

      await container.read(pushBootstrapProvider).init();

      expect(recorder.registeredTokens, isEmpty);
    },
  );

  test('смена токена перерегистрирует устройство новым значением', () async {
    final container = _container(
      port: port,
      configured: true,
      recorder: recorder,
    );
    await container.read(pushBootstrapProvider).init();
    recorder.registeredTokens.clear();

    port.refreshToken('token-2');
    await Future<void>.delayed(Duration.zero);

    expect(recorder.registeredTokens, ['token-2']);
  });

  test(
    'пуш, открытый из фона, ведёт по тому же дип-линку, что и тайл',
    () async {
      final container = _container(
        port: port,
        configured: true,
        recorder: recorder,
      );
      await container.read(pushBootstrapProvider).init();

      port.openMessage(_chatMessage());
      await Future<void>.delayed(Duration.zero);

      expect(recorder.routes, ['/session/c1']);
    },
  );

  test('холодный старт из пуша тоже даёт переход', () async {
    port.initialMessage = _chatMessage();

    final container = _container(
      port: port,
      configured: true,
      recorder: recorder,
    );
    await container.read(pushBootstrapProvider).init();

    expect(recorder.routes, ['/session/c1']);
  });

  test(
    'пуш в форграунде НЕ навигирует, а показывает локальное уведомление',
    () async {
      // Уводить человека с открытого экрана (например, из чата или звонка)
      // из-за входящего пуша нельзя — это и есть разница между «пришло» и
      // «пользователь нажал».
      final container = _container(
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
    },
  );

  test(
    'пуш без известного типа не роняет обработку и никуда не ведёт',
    () async {
      final container = _container(
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
    },
  );
}
