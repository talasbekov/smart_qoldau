/// Тонкая абстракция транспорта реалтайм-шины поверх `socket_io_client`.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:meta/meta.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;
import 'package:web_socket/web_socket.dart' show WebSocketConnectionClosed;

/// Состояние соединения транспорта. `connecting` — сразу после [SqSocket
/// .connect]/на каждой попытке автопереподключения; `connected`/
/// `disconnected` — по фактическим reserved-событиям `socket_io_client`.
enum SqConnectionState { connecting, connected, disconnected }

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

  /// Широковещательный поток состояния соединения — нужен индикатору
  /// «связь восстанавливается» (звонок, чат) и логике переподключения при
  /// подозрении на протухший токен. Как и [events], обычный `Stream`, а не
  /// `ValueStream`: новый подписчик получает только последующие переходы.
  Stream<SqConnectionState> get connectionState;

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
  SocketIoSqSocket({required this.wsBase}) {
    // Одна зона на весь жизненный цикл объекта (а НЕ по одной на вызов
    // connect()) — см. отчёт задачи 8, раунд правок 1, п.1. `_ws.close()`
    // внутри `socket_io_client` (`WebSocketTransport.doClose`,
    // `websocket_transport.dart:132`, `_ws?.close()` без await/catch) может
    // бросить `WebSocketConnectionClosed` АСИНХРОННО — из микрозадачи,
    // читающей закрытый сервером сокет, а не из стека вызова какого-либо
    // нашего метода. Это достижимо равно и через `connect()` (клиент решает
    // мгновенный обрыв внутри своего же ondisconnect-потока), и через
    // публичный `disconnect()` (`socket.dispose()` -> `destroy()` ->
    // `Manager.close()` -> тот же `doClose()`), поэтому оборачивать нужно
    // ОБА метода одной и той же зоной, а не создавать зону заново в
    // `connect()` (тогда `disconnect()`, вызванный отдельно — например, при
    // логауте — остался бы вне зоны и ронял бы изолят тем же самым падением
    // библиотеки, что и было найдено в ручной проверке задачи 8).
    _zone = Zone.current.fork(
      specification: ZoneSpecification(
        handleUncaughtError: (self, parent, zone, error, stack) {
          _handleTransportError(error, stack);
        },
      ),
    );
  }

  /// Адрес бэкенда без пути неймспейса (например, `http://10.0.2.2:3000`) —
  /// `/ws` дописывается при подключении.
  final String wsBase;

  late final Zone _zone;

  final _controller = StreamController<(String, dynamic)>.broadcast();
  final _connectionStateController =
      StreamController<SqConnectionState>.broadcast();

  sio.Socket? _socket;

  @override
  Stream<(String, dynamic)> get events => _controller.stream;

  @override
  Stream<SqConnectionState> get connectionState =>
      _connectionStateController.stream;

  /// Диагностическое состояние транспорта — не часть контракта [SqSocket]
  /// (тестам разбора событий оно не нужно), но нужно ручной проверке
  /// (`tool/ws_smoke.dart`, шаг 3 брифа задачи 8): валидный токен должен
  /// удержать соединение, мусорный — привести к немедленному разрыву.
  bool get isConnected => _socket?.connected ?? false;

  /// Зона, защищающая `connect`/`disconnect`/`emit` — не часть контракта
  /// [SqSocket], видна только тестам структурной регрессии
  /// (`socket_io_sq_socket_test.dart`): она должна быть ОДНОЙ и той же на
  /// протяжении всей жизни сокета (создана в конструкторе), а не
  /// пересоздаваться на каждый `connect()` — именно пересоздание на каждый
  /// вызов оставляло `disconnect()` без защиты в исходной версии фикса
  /// (см. отчёт задачи 8, раунд правок 1, п.1).
  @visibleForTesting
  Zone get debugZone => _zone;

  @override
  Future<void> connect(String token) async {
    await disconnect();
    _zone.run(() {
      _connectionStateController.add(SqConnectionState.connecting);
      final socket = sio.io(
        '$wsBase/ws',
        sio.OptionBuilder()
            .setTransports(['websocket'])
            .setAuth({'token': token})
            .enableReconnection()
            .build(),
      );
      socket.onAny((event, data) => _controller.add((event, data)));
      socket.onConnect(
        (_) => _connectionStateController.add(SqConnectionState.connected),
      );
      socket.onDisconnect(
        (_) => _connectionStateController.add(SqConnectionState.disconnected),
      );
      socket.onReconnectAttempt(
        (_) => _connectionStateController.add(SqConnectionState.connecting),
      );
      _socket = socket;
    });
  }

  @override
  Future<void> disconnect() async {
    final socket = _socket;
    _socket = null;
    if (socket == null) return;
    _zone.run(() {
      socket.dispose();
      _connectionStateController.add(SqConnectionState.disconnected);
    });
  }

  @override
  void emit(String event, dynamic data) =>
      _zone.run(() => _socket?.emit(event, data));

  /// Диагностика асинхронных сбоев транспорта — факт и тип, НИКОГДА не
  /// токен и не содержимое (см. Global Constraints задачи 8). Ожидаемый
  /// `WebSocketConnectionClosed` (двойное закрытие уже закрытого сервером
  /// сокета — см. комментарий в конструкторе) — это не баг нашего кода,
  /// логируем и глушим осознанно. Любой ДРУГОЙ тип ошибки не фильтруем
  /// молча: логируем как потенциальную регрессию транспорта, чтобы её было
  /// видно в диагностике, вместо бесследного исчезновения.
  void _handleTransportError(Object error, StackTrace stack) {
    if (error is WebSocketConnectionClosed) {
      developer.log(
        'соединение разорвано сервером до завершения обмена — '
        'клиентская библиотека попыталась закрыть уже закрытый сокет '
        '(ожидаемо при невалидном/просроченном токене)',
        name: 'SocketIoSqSocket',
      );
      return;
    }
    developer.log(
      'непредвиденная асинхронная ошибка транспорта: ${error.runtimeType}',
      name: 'SocketIoSqSocket',
      level: 1000,
      error: error,
      stackTrace: stack,
    );
  }
}
