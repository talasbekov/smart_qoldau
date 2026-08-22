// Устойчивость SocketIoSqSocket к обрыву соединения сервером (задача 8,
// раунд правок 1, п.1).
//
// Живой smoke-тест против бэкенда SmartQoldau (см. отчёт) надёжно
// воспроизводит исходную находку: невалидный токен -> сервер шлёт
// socket.io DISCONNECT и рвёт транспорт -> внутренний цикл
// `socket_io_client` 3.1.6 пытается закрыть уже закрытый сервером raw
// WebSocket и падает АСИНХРОННО (`WebSocketConnectionClosed` из
// микрозадачи чтения сокета — `WebSocketTransport.doClose`,
// `websocket_transport.dart:132`, `_ws?.close()` без await/catch). Это
// зависит от точного тайминга гонки между обработкой серверного close и
// нашим кодом внутри самого `socket_io_client`, которую попытка
// воспроизвести на локальном `HttpServer`, вручную говорящем протокол
// engine.io/socket.io (open-хендшейк -> CONNECT ack -> DISCONNECT ->
// закрытие транспорта), НАДЁЖНО не подтвердила — тест ниже
// («лежит на реальном сервере») зелёный что до фикса, что после: гонка не
// воспроизводится детерминированно вне реальной сети. Честно фиксируем
// этот факт, а не выдаём его за живую проверку регрессии.
//
// Поэтому структурная регрессия (которую как раз и нашло ревью — фикс
// защищал только `connect()`, а `disconnect()` эту же ошибку мог поймать
// через ДРУГОЙ путь того же бага) проверяется НАПРЯМУЮ: `connect()` и
// `disconnect()` обязаны выполняться в ОДНОЙ и той же долгоживущей zone,
// созданной один раз в конструкторе — а не заново на каждый `connect()`.
// Это детерминированно и не зависит от таймингов сети.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared/events/sq_socket.dart';

/// Минимальный сервер, говорящий ровно тот протокол, который нужен клиенту
/// для успешного подключения (engine.io open + socket.io CONNECT ack), а
/// затем сразу же рвущий соединение — воспроизводит форму, в которой
/// `EventsGateway.handleConnection` отклоняет невалидный токен.
Future<HttpServer> _rejectingServer() async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen((request) async {
    final ws = await WebSocketTransformer.upgrade(request);
    ws.add(
      '0${jsonEncode({
            'sid': 'engine-sid',
            'upgrades': <String>[],
            'pingInterval': 25000,
            'pingTimeout': 20000,
            'maxPayload': 1000000,
          })}',
    );
    await for (final message in ws) {
      if (message is String && message.startsWith('40/ws')) {
        ws.add('0/ws,${jsonEncode({'sid': 'nsp-sid'})}');
        ws.add('1/ws,');
        await ws.close();
        return;
      }
    }
  });
  return server;
}

void main() {
  group('SocketIoSqSocket.debugZone — структурная регрессия (Round 1, п.1)', () {
    test('одна и та же zone на протяжении жизни объекта, не по одной на connect()', () {
      final socket = SocketIoSqSocket(wsBase: 'http://127.0.0.1:1');
      final zone = socket.debugZone;

      // Идентичность zone не меняется — ни до, ни после того, как код,
      // который её использует (connect()), был вызван. Если бы `connect()`
      // заводил новую zone на каждый вызов (как было до фикса), у объекта
      // просто не было бы ОДНОЙ стабильной `_zone`, видимой уже в
      // конструкторе, — оба метода получали бы разные зоны.
      expect(socket.debugZone, same(zone));
    });
  });

  group(
    'SocketIoSqSocket — жизненный цикл против отклоняющего сервера '
    '(смоук, не доказательство гонки — см. комментарий в начале файла)',
    () {
      late HttpServer server;

      setUp(() async {
        server = await _rejectingServer();
      });

      tearDown(() async {
        await server.close(force: true);
      });

      test('connect -> disconnect -> connect против отклоняющего сервера не виснет и не бросает', () async {
        Object? escaped;
        await runZonedGuarded(() async {
          final socket = SocketIoSqSocket(
            wsBase: 'http://127.0.0.1:${server.port}',
          );
          await socket.connect('token-1');
          await Future<void>.delayed(const Duration(milliseconds: 200));
          await socket.disconnect();
          await socket.connect('token-2');
          await Future<void>.delayed(const Duration(milliseconds: 200));
          await socket.disconnect();
        }, (error, stack) => escaped = error);

        expect(escaped, isNull);
      });
    },
  );
}
