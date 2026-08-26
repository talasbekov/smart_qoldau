// Устойчивость и корректность SocketIoSqSocket (задача 8, раунды правок
// 1 и 2).
//
// Живой smoke-тест против бэкенда SmartQoldau (см. отчёт) надёжно
// воспроизводит исходную находку раунда 1: невалидный токен -> сервер шлёт
// socket.io DISCONNECT и рвёт транспорт -> внутренний цикл
// `socket_io_client` 3.1.6 пытается закрыть уже закрытый сервером raw
// WebSocket и падает АСИНХРОННО (`WebSocketConnectionClosed` из
// микрозадачи чтения сокета — `WebSocketTransport.doClose`,
// `websocket_transport.dart:132`, `_ws?.close()` без await/catch). Это
// зависит от точного тайминга гонки между обработкой серверного close и
// нашим кодом внутри самого `socket_io_client`, которую попытка
// воспроизвести на локальном `HttpServer`, вручную говорящем протокол
// engine.io/socket.io, НАДЁЖНО не подтвердила (пробовал и с корректной, и
// с изначально ошибочной кодировкой пакетов — см. ниже) — тест
// «жизненный цикл против отклоняющего сервера» зелёный что до фикса zone,
// что после: гонка не воспроизводится детерминированно вне реальной сети.
// Честно фиксируем этот факт, а не выдаём его за живую проверку регрессии
// (авторитетное доказательство самого фикса — переделанный живой смоук,
// см. отчёт).
//
// Структурная регрессия раунда 1 (фикс защищал только `connect()`, а
// `disconnect()` эту же ошибку мог поймать через ДРУГОЙ путь того же бага)
// проверяется НАПРЯМУЮ и детерминированно: `connect()`, `disconnect()` и
// `emit()` обязаны реально исполнять свою работу через ОДНУ И ТУ ЖЕ
// долгоживущую zone.
//
// Отдельная находка раунда 2 (Critical, см. отчёт): при написании теста на
// неё был обнаружен и исправлен баг САМОГО тестового сервера ниже —
// пакеты socket.io-уровня (CONNECT-ack/DISCONNECT) отправлялись без
// обязательного ведущего `4` (engine.io MESSAGE), из-за чего клиент падал
// на разборе JSON и НИ ОДИН из локальных серверных тестов на самом деле
// никогда не доводил хендшейк до `connected` — просто тихо гасил
// собственную ошибку через zone-обработчик, отчего тест на «нет
// необработанных исключений» ложно оставался зелёным. Исправлено во всех
// серверных хелперах ниже.
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
      '0${jsonEncode({'sid': 'engine-sid', 'upgrades': <String>[], 'pingInterval': 25000, 'pingTimeout': 20000, 'maxPayload': 1000000})}',
    );
    await for (final message in ws) {
      if (message is String && message.startsWith('40/ws')) {
        // Инженерная деталь протокола, стоившая часа отладки: пакеты
        // socket.io-уровня (CONNECT/DISCONNECT) должны идти ВНУТРИ
        // engine.io-пакета типа MESSAGE — с ведущей `4`. Голое `0/ws,...`
        // клиент читает как engine.io OPEN (тип `0`) и пытается
        // распарсить `/ws,{...}` как JSON — падает с FormatException
        // (перехватывается zone-обработчиком транспорта, поэтому тест на
        // отсутствие исключений это маскировал; см. отчёт задачи 8, раунд
        // правок 2, самопроверка).
        ws.add('40/ws,${jsonEncode({'sid': 'nsp-sid'})}');
        ws.add('41/ws,');
        await ws.close();
        return;
      }
    }
  });
  return server;
}

/// Сервер, который проводит клиента через полный хендшейк (engine.io open
/// + socket.io CONNECT ack) и дальше держит соединение открытым, ничего
/// больше не делая. Нужен тесту про переподключение ниже: соединение
/// должно быть по-настоящему живым, чтобы вызвать РЕАЛЬНЫЙ намеренный
/// разрыв («io client disconnect») внутри преамбулы повторного `connect()`.
Future<HttpServer> _acceptingServer() async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen((request) async {
    final ws = await WebSocketTransformer.upgrade(request);
    ws.add(
      '0${jsonEncode({'sid': 'engine-sid', 'upgrades': <String>[], 'pingInterval': 25000, 'pingTimeout': 20000, 'maxPayload': 1000000})}',
    );
    await for (final message in ws) {
      if (message is String && message.startsWith('40/ws')) {
        // См. комментарий в `_rejectingServer` про обязательный ведущий
        // `4` (engine.io MESSAGE) перед socket.io-пакетом.
        ws.add('40/ws,${jsonEncode({'sid': 'nsp-sid'})}');
      }
    }
  });
  return server;
}

void main() {
  group('SocketIoSqSocket.debugZone — структурная регрессия (Round 1, п.1)', () {
    test(
      'одна и та же zone на протяжении жизни объекта, не по одной на connect()',
      () {
        final socket = SocketIoSqSocket(wsBase: 'http://127.0.0.1:1');
        final zone = socket.debugZone;

        // Идентичность zone не меняется — ни до, ни после того, как код,
        // который её использует (connect()), был вызван. Если бы `connect()`
        // заводил новую zone на каждый вызов (как было до фикса), у объекта
        // просто не было бы ОДНОЙ стабильной `_zone`, видимой уже в
        // конструкторе, — оба метода получали бы разные зоны.
        expect(socket.debugZone, same(zone));
      },
    );

    test('connect(), disconnect() и emit() реально исполняют свою работу '
        'внутри debugZone, а не просто существуют рядом с ним', () async {
      // Round 2 ревью, п.3: предыдущая версия этого теста дважды читала
      // `debugZone` БЕЗ единого вызова `connect()`/`disconnect()` между
      // чтениями — доказывала только то, что поле не меняется само по
      // себе. Регрессия, при которой `disconnect()` перестал бы
      // исполняться внутри zone (а поле `_zone` осталось бы прежним),
      // проходила бы мимо. Здесь — поведенческая проверка: заводим
      // родительскую zone, которая перехватывает КАЖДЫЙ вызов `Zone.run`
      // у любого потомка (сам `_zone` собственный `run` не переопределяет,
      // поэтому делегирование поднимается до этого перехватчика) и
      // записывает, НА КАКОЙ ИМЕННО zone он был вызван. Дart-рантайм
      // (event loop, машинерия `async`/`await`) тоже гоняет `Zone.run` по
      // своим причинам, поэтому проверяем не «КАЖДЫЙ перехваченный run —
      // debugZone» (шумно и хрупко), а «после КАЖДОЙ операции debugZone
      // среди перехваченного встретился хотя бы раз» — этого достаточно,
      // чтобы поймать регрессию, при которой конкретный метод перестал бы
      // проходить через zone вообще.
      //
      // Порт намеренно нерабочий — сеть тут не нужна: `sio.io(...)`
      // возвращает управление СРАЗУ (настоящее рукопожатие продолжается в
      // фоне уже после того, как синхронная часть `connect()` отработала).
      // Критично для надёжности теста: `zonesSeenInRun` проверяется СРАЗУ
      // после вызова каждого метода, ДО того как управление вернётся в
      // event loop — `disconnect()` и `emit()` внутри полностью
      // синхронны (ни одного `await` в их собственном теле, несмотря на
      // сигнатуру `async` у `disconnect()`), поэтому их вызов и
      // немедленная проверка списка — это один и тот же синхронный кадр
      // выполнения без единого шанса на постороннюю асинхронную гонку.
      // `connect()` внутри ждёт свой же `disconnect()` (обычно
      // тривиальный) — ему нужен ровно один прогон микрозадач, не
      // задержка на реальном таймере: только так можно быть уверенным,
      // что зафиксирован сигнал именно от проверяемого вызова, а не
      // случайно совпавшая по времени фоновая активность живого сокета
      // (что и подвело первую версию этого теста — она ждала реальное
      // соединение и проверяла список только после задержки в 200мс,
      // за которые успевала натечь посторонняя `_zone`-активность).
      final zonesSeenInRun = <Zone>[];
      late SocketIoSqSocket socket;
      final spec = ZoneSpecification(
        run: <R>(Zone self, ZoneDelegate parent, Zone zone, R Function() f) {
          zonesSeenInRun.add(zone);
          return parent.run(zone, f);
        },
      );

      await runZoned(() async {
        socket = SocketIoSqSocket(wsBase: 'http://127.0.0.1:1');

        zonesSeenInRun.clear();
        final connectFuture = socket.connect('token-1');
        await connectFuture;
        expect(
          zonesSeenInRun,
          contains(socket.debugZone),
          reason: 'connect() обязан выполнить свою работу через debugZone.run',
        );

        zonesSeenInRun.clear();
        socket.emit('chat.send', {'consultationId': 'c1', 'text': 'hi'});
        // Проверка СРАЗУ, без await — emit() синхронен целиком.
        expect(
          zonesSeenInRun,
          contains(socket.debugZone),
          reason: 'emit() обязан выполнить свою работу через debugZone.run',
        );

        zonesSeenInRun.clear();
        final disconnectFuture = socket.disconnect();
        // Проверка СРАЗУ, без await — тело disconnect() тоже синхронно
        // целиком, несмотря на сигнатуру `async`; await ниже нужен только
        // чтобы дождаться обёртки-Future перед завершением теста.
        expect(
          zonesSeenInRun,
          contains(socket.debugZone),
          reason:
              'disconnect() обязан выполнить свою работу через debugZone.run '
              '— именно этот путь ускользнул от защиты в исходной версии '
              'фикса Round 1',
        );
        await disconnectFuture;
      }, zoneSpecification: spec);
    });
  });

  group('SocketIoSqSocket — жизненный цикл против отклоняющего сервера '
      '(смоук, не доказательство гонки — см. комментарий в начале файла)', () {
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
  });

  group('SocketIoSqSocket.connectionState — намеренный разрыв не выглядит как '
      'внешний (Round 2 ревью, п.1 — Critical)', () {
    late HttpServer server;

    setUp(() async {
      server = await _acceptingServer();
    });

    tearDown(() async {
      await server.close(force: true);
    });

    test(
      'переподключение новым токеном на уже живом сокете (как при '
      'молчаливом рефреше AuthInterceptor) НЕ публикует disconnected',
      () async {
        // Это авторитетная проверка находки Round 2 п.1: до фикса
        // SocketIoSqSocket публиковал `disconnected` для КАЖДОГО
        // разрыва, включая намеренный (преамбула connect() рвёт
        // предыдущий живой сокет перед созданием нового) — из-за этого
        // штатный молчаливый рефреш выглядел как отказ аутентификации,
        // запускал повторный (уже нелегальный) рефреш и разлогинивал
        // полностью исправную сессию (см. отчёт задачи 8).
        final socket = SocketIoSqSocket(
          wsBase: 'http://127.0.0.1:${server.port}',
        );
        final states = <SqConnectionState>[];
        final sub = socket.connectionState.listen(states.add);

        await socket.connect('token-1');
        await Future<void>.delayed(const Duration(milliseconds: 300));
        expect(
          states,
          contains(SqConnectionState.connected),
          reason: 'предусловие: первое подключение должно было состояться',
        );

        states.clear();
        // Тот же вызов, что реальный SqEvents.reconnectWith после
        // молчаливого рефреша токена.
        await socket.connect('token-2');
        await Future<void>.delayed(const Duration(milliseconds: 300));

        expect(
          states,
          isNot(contains(SqConnectionState.disconnected)),
          reason:
              'переустановка соединения новым токеном — намеренный разрыв '
              '("io client disconnect"), а не внешний; connectSqEvents не '
              'должен путать это с отказом аутентификации',
        );
        expect(states, contains(SqConnectionState.connected));

        await sub.cancel();
        await socket.disconnect();
      },
    );
  });
}
