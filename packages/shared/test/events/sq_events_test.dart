// Тесты разбора реалтайм-событий (задача 8 эпика E6).
//
// Все тесты подают сырые пары `(имя события, payload)` через фейковый
// транспорт `_FakeSqSocket` в `SqEvents.stream`/`forConsultation` — ни один
// тест не вызывает `SqEvent.fromRaw` напрямую, чтобы действительно
// проверять путь «транспорт -> разобранное событие», а не сам парсер в
// изоляции (см. урок задачи 5 эпика E6 — тесты мимо реального пути мимо и
// бага проходят).
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

/// Фейковая реализация [SqSocket] — без сети, без платформенных каналов.
/// `pushRaw` эмулирует событие, пришедшее от бэкенда.
class _FakeSqSocket implements SqSocket {
  final _controller = StreamController<(String, dynamic)>.broadcast();
  final _connectionStateController =
      StreamController<SqConnectionState>.broadcast();
  final List<(String, dynamic)> emitted = [];
  final List<String> connectCalls = [];
  int disconnectCalls = 0;

  @override
  Stream<(String, dynamic)> get events => _controller.stream;

  @override
  Stream<SqConnectionState> get connectionState =>
      _connectionStateController.stream;

  void pushConnectionState(SqConnectionState state) =>
      _connectionStateController.add(state);

  @override
  void emit(String event, dynamic data) => emitted.add((event, data));

  @override
  Future<void> connect(String token) async => connectCalls.add(token);

  @override
  Future<void> disconnect() async => disconnectCalls++;

  void pushRaw(String event, dynamic data) => _controller.add((event, data));

  Future<void> close() async {
    await _controller.close();
    await _connectionStateController.close();
  }
}

void main() {
  late _FakeSqSocket socket;
  late SqEvents events;

  setUp(() {
    socket = _FakeSqSocket();
    events = SqEvents(socket);
  });

  tearDown(() => socket.close());

  group('request.updated', () {
    test('матч даёт RequestUpdated с matchedExpert/consultationId', () async {
      final future = events.stream.first;
      socket.pushRaw('request.updated', {
        'id': 'r1',
        'status': 'MATCHED',
        'consultationId': 'c1',
      });

      final event = await future;
      expect(event, isA<RequestUpdated>());
      final updated = event as RequestUpdated;
      expect(updated.id, 'r1');
      expect(updated.status, RequestStatus.matched);
      expect(updated.consultationId, 'c1');
      expect(updated.matchedExpert, isNull);
      expect(updated.hotlines, isNull);
    });

    test(
      'пустая заявка без экспертов даёт status без остальных полей',
      () async {
        final future = events.stream.first;
        socket.pushRaw('request.updated', {'id': 'r2', 'status': 'NO_EXPERTS'});

        final updated = await future as RequestUpdated;
        expect(updated.status, RequestStatus.noExperts);
        expect(updated.consultationId, isNull);
        expect(updated.matchedExpert, isNull);
        expect(updated.hotlines, isNull);
      },
    );

    test('callback-эскалация несёт hotlines', () async {
      final future = events.stream.first;
      socket.pushRaw('request.updated', {
        'id': 'r3',
        'status': 'CALLBACK_REQUESTED',
        'hotlines': ['150', '111'],
      });

      final updated = await future as RequestUpdated;
      expect(updated.status, RequestStatus.callbackRequested);
      expect(updated.hotlines, ['150', '111']);
    });

    test('matchedExpert разбирается в ExpertPublic', () async {
      final future = events.stream.first;
      socket.pushRaw('request.updated', {
        'id': 'r4',
        'status': 'MATCHED',
        'consultationId': 'c4',
        'matchedExpert': {
          'id': 'e1',
          'displayName': 'Айгуль Сатпаева',
          'city': 'Алматы',
          'experience': 'THREE_TO_FIVE',
          'priceTiyn': 500000,
          'languages': ['ru'],
          'formats': ['chat'],
          'topicSlugs': ['anxiety-stress'],
          'workStatus': 'ACCEPTING',
          'ratingAvg': 4.8,
          'ratingCount': 23,
        },
      });

      final updated = await future as RequestUpdated;
      expect(updated.matchedExpert, isNotNull);
      expect(updated.matchedExpert!.displayName, 'Айгуль Сатпаева');
    });
  });

  group('consultation.updated', () {
    test('патч только с paymentStatus держит остальные поля null', () async {
      final future = events.stream.first;
      socket.pushRaw('consultation.updated', {
        'id': 'c1',
        'paymentStatus': 'HELD',
      });

      final event = await future as ConsultationUpdated;
      expect(event.id, 'c1');
      expect(event.paymentStatus, ConsultationPaymentStatus.held);
      expect(event.status, isNull);
      expect(event.outcome, isNull);
      expect(event.format, isNull);
    });

    test('патч со status/outcome не трогает paymentStatus/format', () async {
      final future = events.stream.first;
      socket.pushRaw('consultation.updated', {
        'id': 'c2',
        'status': 'COMPLETED',
        'outcome': 'CLIENT_NO_SHOW',
      });

      final event = await future as ConsultationUpdated;
      expect(event.status, ConsultationStatus.completed);
      expect(event.outcome, ConsultationOutcome.clientNoShow);
      expect(event.paymentStatus, isNull);
      expect(event.format, isNull);
    });

    test('патч с format не трогает остальные поля', () async {
      final future = events.stream.first;
      socket.pushRaw('consultation.updated', {'id': 'c3', 'format': 'video'});

      final event = await future as ConsultationUpdated;
      expect(event.format, SessionFormat.video);
      expect(event.status, isNull);
      expect(event.outcome, isNull);
      expect(event.paymentStatus, isNull);
    });
  });

  group('chat.message', () {
    test('разбирается в ChatMessage', () async {
      final future = events.stream.first;
      socket.pushRaw('chat.message', {
        'id': 'm1',
        'consultationId': 'c1',
        'senderRole': 'client',
        'text': 'Здравствуйте',
        'createdAt': '2026-08-22T10:00:00.000Z',
      });

      final event = await future as ChatMessageEvent;
      expect(event.message.id, 'm1');
      expect(event.message.consultationId, 'c1');
      expect(event.message.senderRole, 'client');
      expect(event.message.text, 'Здравствуйте');
    });
  });

  group('chat.typing', () {
    test('разбирается в ChatTypingEvent', () async {
      final future = events.stream.first;
      socket.pushRaw('chat.typing', {
        'consultationId': 'c1',
        'senderRole': 'expert',
      });

      final event = await future as ChatTypingEvent;
      expect(event.consultationId, 'c1');
      expect(event.senderRole, 'expert');
    });
  });

  group('chat.error', () {
    test('разбирается в ChatErrorEvent с кодом', () async {
      final future = events.stream.first;
      socket.pushRaw('chat.error', {'code': 'CONSULTATION_NOT_ACTIVE'});

      final event = await future as ChatErrorEvent;
      expect(event.code, 'CONSULTATION_NOT_ACTIVE');
    });
  });

  group('notification.new', () {
    test('разбирается в NotificationNew по id/type', () async {
      final future = events.stream.first;
      socket.pushRaw('notification.new', {
        'id': 'n1',
        'type': 'earning.credited',
        // Бэкенд шлёт больше полей (title/body/data/createdAt) — модель
        // события сознательно берёт только id/type (см. бриф задачи 8);
        // лишние поля должны просто игнорироваться, а не ронять разбор.
        'title': 'Начисление',
        'body': 'Вам начислено 5000 ₸',
        'data': <String, dynamic>{},
        'createdAt': '2026-08-22T10:00:00.000Z',
      });

      final event = await future as NotificationNew;
      expect(event.id, 'n1');
      expect(event.type, 'earning.credited');
    });
  });

  group('неизвестные события', () {
    test('неизвестное имя даёт UnknownEvent и не роняет поток', () async {
      final received = <SqEvent>[];
      final sub = events.stream.listen(received.add);

      // Экспертское событие, которого клиент по контракту не получает, но
      // шина обязана его пережить (см. брифинг задачи 8).
      socket.pushRaw('offer.new', {'offerId': 'o1'});
      // И следующее валидное событие должно дойти как ни в чём не бывало.
      socket.pushRaw('notification.new', {'id': 'n2', 'type': 'x'});

      await Future<void>.delayed(Duration.zero);
      await sub.cancel();

      expect(received, hasLength(2));
      expect(received[0], isA<UnknownEvent>());
      expect((received[0] as UnknownEvent).name, 'offer.new');
      expect((received[0] as UnknownEvent).data, {'offerId': 'o1'});
      expect(received[1], isA<NotificationNew>());
    });

    test(
      'искажённый payload известного события деградирует в UnknownEvent',
      () async {
        final future = events.stream.first;
        // 'status' отсутствует — RequestUpdated его требует.
        socket.pushRaw('request.updated', {'id': 'r1'});

        final event = await future;
        expect(event, isA<UnknownEvent>());
      },
    );
  });

  group('forConsultation', () {
    test('не пропускает события другой консультации', () async {
      final received = <SqEvent>[];
      final sub = events.forConsultation('c1').listen(received.add);

      socket.pushRaw('chat.message', {
        'id': 'm1',
        'consultationId': 'c2',
        'senderRole': 'client',
        'text': 'чужое',
        'createdAt': '2026-08-22T10:00:00.000Z',
      });
      socket.pushRaw('chat.message', {
        'id': 'm2',
        'consultationId': 'c1',
        'senderRole': 'client',
        'text': 'своё',
        'createdAt': '2026-08-22T10:00:00.000Z',
      });
      socket.pushRaw('chat.typing', {
        'consultationId': 'c2',
        'senderRole': 'expert',
      });
      socket.pushRaw('chat.typing', {
        'consultationId': 'c1',
        'senderRole': 'expert',
      });
      socket.pushRaw('consultation.updated', {'id': 'c2', 'format': 'audio'});
      socket.pushRaw('consultation.updated', {'id': 'c1', 'format': 'video'});
      // Событие без consultationId вообще — не должно попасть ни в какую
      // фильтрацию по id.
      socket.pushRaw('notification.new', {'id': 'n1', 'type': 'x'});

      await Future<void>.delayed(Duration.zero);
      await sub.cancel();

      expect(received, hasLength(3));
      expect((received[0] as ChatMessageEvent).message.text, 'своё');
      expect((received[1] as ChatTypingEvent).consultationId, 'c1');
      expect((received[2] as ConsultationUpdated).format, SessionFormat.video);
    });
  });

  group('sendChat/sendTyping', () {
    // Записи `emitted` — record `(String, dynamic)`, где второе поле —
    // Map: сравнивать сам record целиком через `equals` нельзя — у Map нет
    // содержательного `==` (только по ссылке), а `equals`-матчер не
    // разворачивает поля record-типа рекурсивно, чтобы применить к ним
    // отдельно свою deep-collection-логику. Сравниваем имя события и тело
    // раздельно, чтобы содержимое Map сверялось честно (по значению).
    test('sendChat эмитит chat.send с consultationId и text', () {
      events.sendChat('c1', 'Привет');

      expect(socket.emitted, hasLength(1));
      final (event, body) = socket.emitted.single;
      expect(event, 'chat.send');
      expect(body, {'consultationId': 'c1', 'text': 'Привет'});
    });

    test('sendTyping эмитит chat.typing с consultationId', () {
      events.sendTyping('c1');

      expect(socket.emitted, hasLength(1));
      final (event, body) = socket.emitted.single;
      expect(event, 'chat.typing');
      expect(body, {'consultationId': 'c1'});
    });
  });

  group('reconnectWith', () {
    test(
      'переустанавливает соединение через socket.connect с новым токеном',
      () async {
        await events.reconnectWith('new-token');

        expect(socket.connectCalls, ['new-token']);
        expect(socket.disconnectCalls, 0);
      },
    );
  });

  group('connectionState', () {
    test('прокидывает переходы транспорта как есть', () async {
      final received = <SqConnectionState>[];
      final sub = events.connectionState.listen(received.add);

      socket.pushConnectionState(SqConnectionState.connecting);
      socket.pushConnectionState(SqConnectionState.connected);
      socket.pushConnectionState(SqConnectionState.disconnected);
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();

      expect(received, [
        SqConnectionState.connecting,
        SqConnectionState.connected,
        SqConnectionState.disconnected,
      ]);
    });
  });

  group('SqEvent.toString — не содержит PII', () {
    // Round 1 ревью задачи 8, п.6: toString() нужен для диагностики, но
    // текст сообщения чата (PII) в нём быть не должно.
    test('ChatMessageEvent.toString не содержит текст сообщения', () {
      const secret = 'секретный текст сообщения клиента';
      final event = ChatMessageEvent(
        ChatMessage(
          id: 'm1',
          consultationId: 'c1',
          senderRole: 'client',
          text: secret,
          createdAt: DateTime(2026, 8, 22),
        ),
      );

      expect(event.toString(), isNot(contains(secret)));
      expect(event.toString(), contains('m1'));
      expect(event.toString(), contains('c1'));
    });

    test('UnknownEvent.toString не включает сырой payload', () {
      final event = UnknownEvent(name: 'offer.new', data: {'secret': 'x'});

      expect(event.toString(), isNot(contains('secret')));
      expect(event.toString(), contains('offer.new'));
    });
  });
}
