/// Тонкая абстракция транспорта реалтайм-шины поверх `socket_io_client`.
library;

import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as sio;

/// Абстракция транспорта, которую использует [SqEvents].
///
/// Существует ровно для одной причины: тесты разбора событий подставляют
/// фейковую реализацию вместо реальной сети — им не нужен ни сокет, ни
/// платформенный канал. Единственная реализация, которая знает о пакете
/// `socket_io_client`, — [SocketIoSqSocket]; больше нигде в пакете `shared`
/// (и тем более в `app_client`) на него напрямую не ссылаются.
abstract class SqSocket {
  /// Широковещательный поток сырых пар `(имя события, payload)`, которые
  /// прислал бэкенд. Обязан быть broadcast-потоком — на него одновременно
  /// подписываются несколько экранов через [SqEvents.stream] и
  /// [SqEvents.forConsultation].
  Stream<(String event, dynamic data)> get events;

  /// Отправляет [data] бэкенду под именем [event] (например,
  /// `chat.send`/`chat.typing`).
  void emit(String event, dynamic data);

  /// Устанавливает соединение с access-токеном [token] в хендшейке.
  ///
  /// Вызывается повторно и для первого подключения, и для переустановки
  /// соединения с новым токеном (см. [SqEvents.reconnectWith]) — реализация
  /// сама рвёт предыдущее соединение, если оно было.
  Future<void> connect(String token);

  /// Рвёт текущее соединение (например, при разлогине). Безопасно вызывать,
  /// даже если соединения не было.
  Future<void> disconnect();
}

/// Реализация [SqSocket] поверх `socket_io_client`.
///
/// Неймспейс — именно `/ws` (бэкенд: `@WebSocketGateway({namespace: '/ws'})`,
/// см. `backend/src/ws/events.gateway.ts`), это НЕ путь engine.io — бэкенд
/// сознательно развёл их, чтобы не конфликтовать с дефолтным `/socket.io`.
/// Токен уходит в `auth.token` хендшейка (`handshake.auth.token` на
/// бэкенде), а не query-параметром.
class SocketIoSqSocket implements SqSocket {
  SocketIoSqSocket({required this.wsBase});

  /// Адрес бэкенда без пути неймспейса (например, `http://10.0.2.2:3000`) —
  /// `/ws` дописывается при подключении.
  final String wsBase;

  final _controller = StreamController<(String, dynamic)>.broadcast();

  sio.Socket? _socket;

  @override
  Stream<(String, dynamic)> get events => _controller.stream;

  /// Диагностическое состояние транспорта — не часть контракта [SqSocket]
  /// (тестам разбора событий оно не нужно), но нужно ручной проверке
  /// (`tool/ws_smoke.dart`, шаг 3 брифа задачи 8): валидный токен должен
  /// удержать соединение, мусорный — привести к немедленному разрыву.
  bool get isConnected => _socket?.connected ?? false;

  @override
  Future<void> connect(String token) async {
    await disconnect();
    // runZonedGuarded — не украшение, а обязательная защита: с невалидным
    // токеном сервер рвёт соединение немедленно, ДО завершения хендшейка, и
    // внутренний цикл `socket_io_client` (3.1.6) в этот момент пытается
    // закрыть уже закрытый сервером raw WebSocket — `IOWebSocket.close()`
    // бросает `WebSocketConnectionClosed` асинхронно, из микрозадачи чтения
    // сокета, а не из вызова этого метода. Обычный `try/catch` вокруг
    // `sio.io(...)` его не поймает (стек к этому моменту давно размотан) —
    // без zone-обработчика это необработанное исключение уронило бы весь
    // изолят (см. отчёт задачи 8: ручная проверка с мусорным токеном).
    // `enableReconnection()` сам продолжает попытки переподключения,
    // `isConnected`/пустой поток `events` и так честно показывают разрыв —
    // здесь достаточно проглотить асинхронный сбой транспорта, не потеряв
    // ничего содержательного.
    runZonedGuarded(
      () {
        final socket = sio.io(
          '$wsBase/ws',
          sio.OptionBuilder()
              .setTransports(['websocket'])
              .setAuth({'token': token})
              .enableReconnection()
              .build(),
        );
        socket.onAny((event, data) => _controller.add((event, data)));
        _socket = socket;
      },
      (error, stack) {},
    );
  }

  @override
  Future<void> disconnect() async {
    final socket = _socket;
    _socket = null;
    socket?.dispose();
  }

  @override
  void emit(String event, dynamic data) => _socket?.emit(event, data);
}
