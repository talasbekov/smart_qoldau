// Юнит-тесты ChatController (Step 1 брифа задачи 13): история, догрузка по
// курсору, отправка через WS с ожиданием эха, ошибка отправки, индикатор
// набора и завершение консультации.
//
// Как и в задаче 10, тесты живут в `testWidgets`: контроллер использует
// настоящие таймеры (тик оставшегося времени, гашение чужого «печатает»
// через 3 с, дебаунс своего), а виртуальное время даёт только
// `tester.pump(Duration)`.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

class MockSqApi extends Mock implements SqApi {}

class _RecordingAnalytics implements AnalyticsPort {
  final List<AnalyticsEvent> events = [];

  @override
  Future<void> track(AnalyticsEvent event) async => events.add(event);

  @override
  Future<void> identify(String distinctId, {required bool isGuest}) async {}
}

final _analytics = _RecordingAnalytics();

/// Фейковый транспорт шины: тест сам решает, что и когда приходит от
/// бэкенда, и видит, что клиент отправил в сокет (`chat.send`/`chat.typing`).
class _FakeSqSocket implements SqSocket {
  final _events = StreamController<(String, dynamic)>.broadcast();
  final List<(String, dynamic)> emitted = [];

  void push(String event, dynamic data) => _events.add((event, data));

  @override
  Stream<(String, dynamic)> get events => _events.stream;

  @override
  Stream<SqConnectionState> get connectionState => const Stream.empty();

  @override
  void emit(String event, dynamic data) => emitted.add((event, data));

  @override
  Future<void> connect(String token) async {}

  @override
  Future<void> disconnect() async {}

  Future<void> dispose() => _events.close();
}

final _startedAt = DateTime(2026, 8, 22, 10);

ExpertPublic _expert() => const ExpertPublic(
  id: 'e1',
  displayName: 'Динара С.',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  priceTiyn: 399000,
  languages: ['ru'],
  formats: [SessionFormat.chat],
  topicSlugs: ['anxiety-stress'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.9,
  ratingCount: 312,
);

ClientConsultation _consultation({
  ConsultationStatus status = ConsultationStatus.active,
}) => ClientConsultation(
  id: 'c1',
  status: status,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: _startedAt,
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: ConsultationPaymentStatus.held,
  expert: _expert(),
);

ChatMessage _message(String id, String role, String text, int minute) =>
    ChatMessage(
      id: id,
      consultationId: 'c1',
      senderRole: role,
      text: text,
      createdAt: _startedAt.add(Duration(minutes: minute)),
    );

Map<String, dynamic> _messageJson(
  String id,
  String role,
  String text,
  int minute,
) => {
  'id': id,
  'consultationId': 'c1',
  'senderRole': role,
  'text': text,
  'createdAt': _startedAt.add(Duration(minutes: minute)).toIso8601String(),
};

ProviderContainer _container({required SqApi api, required SqSocket socket}) {
  final container = ProviderContainer(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
      analyticsProvider.overrideWithValue(_analytics),
    ],
  );
  addTearDown(container.dispose);
  container.listen(
    chatControllerProvider('c1'),
    (previous, next) {},
    fireImmediately: true,
  );
  return container;
}

ChatState _state(ProviderContainer container) =>
    container.read(chatControllerProvider('c1')).requireValue;

/// Утилизирует контейнер в теле теста: пока жив провайдер, живы его
/// таймеры, а `flutter_test` проверяет отсутствие таймеров ДО tearDown.
void _disposeNow(ProviderContainer container) => container.dispose();

void main() {
  late MockSqApi api;
  late _FakeSqSocket socket;

  setUp(() {
    api = MockSqApi();
    socket = _FakeSqSocket();
    addTearDown(socket.dispose);
    when(() => api.consultationById('c1'))
        .thenAnswer((_) async => _consultation());
    when(
      () => api.consultationMessages(
        'c1',
        cursor: any(named: 'cursor'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => MessageHistory(
        items: [
          _message('m1', 'expert', 'Здравствуйте!', 0),
          _message('m2', 'client', 'Здравствуйте', 1),
        ],
      ),
    );
  });

  testWidgets('история приходит в хронологическом порядке', (tester) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();

    expect(_state(container).messages.map((m) => m.id), ['m1', 'm2']);
    expect(_state(container).status, ConsultationStatus.active);

    _disposeNow(container);
  });

  testWidgets('догрузка по курсору дописывает страницу и не дублирует id', (
    tester,
  ) async {
    // ВАЖНО: бэкенд (`ChatService.history`) листает ВПЕРЁД — курсор
    // указывает на последнее сообщение страницы, а следующая страница
    // содержит сообщения ПОЗЖЕ него. Значит догрузка дописывает в конец,
    // а не в начало, как предполагал бриф.
    when(
      () => api.consultationMessages(
        'c1',
        cursor: null,
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => MessageHistory(
        items: [_message('m1', 'expert', 'Первое', 0)],
        nextCursor: 'm1',
      ),
    );
    when(
      () => api.consultationMessages(
        'c1',
        cursor: 'm1',
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => MessageHistory(
        items: [
          _message('m1', 'expert', 'Первое', 0),
          _message('m2', 'client', 'Второе', 1),
        ],
      ),
    );

    final container = _container(api: api, socket: socket);
    await tester.pump();
    await tester.pump();

    expect(_state(container).messages.map((m) => m.id), ['m1', 'm2']);
    expect(_state(container).nextCursor, isNull);

    _disposeNow(container);
  });

  testWidgets('отправка уходит в сокет один раз и ждёт эха сервера', (
    tester,
  ) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();

    container.read(chatControllerProvider('c1').notifier).send('привет');
    await tester.pump();

    expect(socket.emitted.where((e) => e.$1 == 'chat.send').length, 1);
    expect(_state(container).pending.single.text, 'привет');
    expect(_state(container).pending.single.failed, isFalse);

    socket.push('chat.message', _messageJson('m3', 'client', 'привет', 2));
    await tester.pump();

    expect(_state(container).pending, isEmpty);
    expect(_state(container).messages.last.id, 'm3');

    _disposeNow(container);
  });

  testWidgets('chat.error помечает сообщение как неотправленное', (
    tester,
  ) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();

    container.read(chatControllerProvider('c1').notifier).send('привет');
    await tester.pump();

    socket.push('chat.error', {'code': 'CONSULTATION_NOT_ACTIVE'});
    await tester.pump();

    expect(_state(container).pending.single.failed, isTrue);
    expect(_state(container).messages.map((m) => m.id), ['m1', 'm2']);

    _disposeNow(container);
  });

  testWidgets('чужой chat.typing включает индикатор и гасит его через 3 с', (
    tester,
  ) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();

    socket.push('chat.typing', {
      'consultationId': 'c1',
      'senderRole': 'expert',
    });
    await tester.pump();
    expect(_state(container).peerTyping, isTrue);

    await tester.pump(const Duration(seconds: 2));
    expect(_state(container).peerTyping, isTrue);

    await tester.pump(const Duration(seconds: 1));
    expect(_state(container).peerTyping, isFalse);

    _disposeNow(container);
  });

  testWidgets('собственный chat.typing не включает чужой индикатор', (
    tester,
  ) async {
    // Бэкенд рассылает событие обоим участникам; принять своё же за чужое
    // означало бы вечное «печатает…» у самого себя.
    final container = _container(api: api, socket: socket);
    await tester.pump();

    socket.push('chat.typing', {
      'consultationId': 'c1',
      'senderRole': 'client',
    });
    await tester.pump();

    expect(_state(container).peerTyping, isFalse);

    _disposeNow(container);
  });

  testWidgets('свой индикатор набора шлётся не чаще раза в секунду', (
    tester,
  ) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();
    final notifier = container.read(chatControllerProvider('c1').notifier);

    notifier.typing();
    notifier.typing();
    notifier.typing();
    await tester.pump();
    expect(socket.emitted.where((e) => e.$1 == 'chat.typing').length, 1);

    await tester.pump(const Duration(seconds: 1));
    notifier.typing();
    await tester.pump();
    expect(socket.emitted.where((e) => e.$1 == 'chat.typing').length, 2);

    _disposeNow(container);
  });

  testWidgets('consultation.updated со статусом completed меняет статус', (
    tester,
  ) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();

    socket.push('consultation.updated', {'id': 'c1', 'status': 'COMPLETED'});
    await tester.pump();

    expect(_state(container).status, ConsultationStatus.completed);

    _disposeNow(container);
  });

  testWidgets('оставшееся время уменьшается и не уходит в минус', (
    tester,
  ) async {
    // Плановое время вышло — сессию это не закрывает (исход фиксирует
    // специалист), но и отрицательного остатка быть не должно.
    when(() => api.consultationById('c1')).thenAnswer(
      (_) async => ClientConsultation(
        id: 'c1',
        status: ConsultationStatus.active,
        format: SessionFormat.chat,
        isEmergency: false,
        startedAt: DateTime.now().subtract(const Duration(minutes: 49)),
        priceTiyn: 399000,
        plannedDurationMin: 50,
        paymentStatus: ConsultationPaymentStatus.held,
        expert: _expert(),
      ),
    );

    final container = _container(api: api, socket: socket);
    await tester.pump();

    final initial = _state(container).remaining;
    expect(initial.inSeconds, lessThanOrEqualTo(60));
    expect(initial.inSeconds, greaterThan(0));

    await tester.pump(const Duration(seconds: 2));
    expect(_state(container).remaining, lessThan(initial));

    await tester.pump(const Duration(minutes: 2));
    expect(_state(container).remaining, Duration.zero);
    expect(_state(container).status, ConsultationStatus.active);

    _disposeNow(container);
  });

  testWidgets('сообщение, пришедшее ПОКА грузится история, не теряется', (
    tester,
  ) async {
    // Подписка на шину открывается раньше запроса истории — иначе окно
    // между ними глотало бы сообщения. Гонка воспроизведена затвором
    // (урок 3), а не таймингом.
    final gate = Completer<void>();
    when(
      () => api.consultationMessages(
        'c1',
        cursor: any(named: 'cursor'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer((_) async {
      await gate.future;
      return MessageHistory(items: [_message('m1', 'expert', 'Первое', 0)]);
    });

    final container = _container(api: api, socket: socket);
    await tester.pump();

    socket.push(
      'chat.message',
      _messageJson('m9', 'expert', 'Пока грузили', 3),
    );
    await tester.pump();

    gate.complete();
    await tester.pump();

    expect(_state(container).messages.map((m) => m.id), ['m1', 'm9']);

    _disposeNow(container);
  });

  testWidgets('открытие активной консультации даёт событие session_started', (
    tester,
  ) async {
    _analytics.events.clear();
    final container = _container(api: api, socket: socket);
    await tester.pump();

    expect(_analytics.events.map((e) => e.name), contains('session_started'));
    expect(
      _analytics.events
          .firstWhere((e) => e.name == 'session_started')
          .properties['format'],
      'chat',
    );

    _disposeNow(container);
  });

  testWidgets('завершение консультации даёт session_ended с исходом', (
    tester,
  ) async {
    _analytics.events.clear();
    final container = _container(api: api, socket: socket);
    await tester.pump();

    socket.push('consultation.updated', {
      'id': 'c1',
      'status': 'COMPLETED',
      'outcome': 'COMPLETED',
    });
    await tester.pump();

    final ended = _analytics.events.where((e) => e.name == 'session_ended');
    expect(ended, hasLength(1));
    expect(ended.single.properties['outcome'], 'COMPLETED');
    expect(ended.single.properties['duration_sec'], isA<int>());

    _disposeNow(container);
  });

  testWidgets('завершённая при открытии консультация session_started не шлёт', (
    tester,
  ) async {
    // Открытая из истории переписка — это чтение, а не сессия: событие
    // начала сессии здесь было бы ложным.
    when(() => api.consultationById('c1')).thenAnswer(
      (_) async => _consultation(status: ConsultationStatus.completed),
    );
    _analytics.events.clear();

    final container = _container(api: api, socket: socket);
    await tester.pump();

    expect(
      _analytics.events.map((e) => e.name),
      isNot(contains('session_started')),
    );

    _disposeNow(container);
  });

  testWidgets('сообщение чужой консультации в чат не попадает', (tester) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();

    socket.push('chat.message', {
      'id': 'x1',
      'consultationId': 'c-other',
      'senderRole': 'expert',
      'text': 'чужое',
      'createdAt': _startedAt.toIso8601String(),
    });
    await tester.pump();

    expect(_state(container).messages.map((m) => m.id), ['m1', 'm2']);

    _disposeNow(container);
  });
}
