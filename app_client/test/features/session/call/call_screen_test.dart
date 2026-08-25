// Виджет-тесты экрана звонка (сверх минимума брифа — урок 1): состояния
// соединения, баннер реконнекта, деградация в чат и отказ в разрешении.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/session/call/ui/call_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

class _FakeCallEngine implements CallEngine {
  final _states = StreamController<CallEngineState>.broadcast();
  int disconnects = 0;
  bool? micEnabled;

  void push(CallEngineState state) => _states.add(state);

  @override
  Stream<CallEngineState> get states => _states.stream;

  @override
  Future<void> connect(String url, String token) async {}

  @override
  Future<void> disconnect() async => disconnects++;

  @override
  Future<void> setMicEnabled(bool enabled) async => micEnabled = enabled;

  @override
  Future<void> setCamEnabled(bool enabled) async {}

  Future<void> dispose() => _states.close();
}

class _FakePermissionService implements PermissionService {
  _FakePermissionService({this.granted = true});

  final bool granted;
  int settingsOpened = 0;

  @override
  Future<void> request(SqPermission permission) async {}

  @override
  Future<bool> ensure(SqPermission permission) async => granted;

  @override
  Future<void> openSettings() async => settingsOpened++;
}

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

ExpertPublic _expert() => const ExpertPublic(
  id: 'e1',
  displayName: 'Динара С.',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  priceTiyn: 399000,
  languages: ['ru'],
  formats: [SessionFormat.audio],
  topicSlugs: ['anxiety-stress'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.9,
  ratingCount: 312,
);

ClientConsultation _consultation() => ClientConsultation(
  id: 'c1',
  status: ConsultationStatus.active,
  format: SessionFormat.audio,
  isEmergency: false,
  startedAt: DateTime.now().subtract(const Duration(minutes: 5)),
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: ConsultationPaymentStatus.held,
  expert: _expert(),
);

Widget _wrap({
  required SqApi api,
  required CallEngine engine,
  required PermissionService permissions,
  required SqSocket socket,
  SessionFormat format = SessionFormat.audio,
}) {
  final router = GoRouter(
    initialLocation: RoutePaths.call('c1', format),
    routes: [
      GoRoute(
        path: RoutePaths.callPattern,
        builder: (context, state) => CallScreen(
          consultationId: state.pathParameters['id']!,
          format: state.uri.queryParameters['format'] == 'video'
              ? SessionFormat.video
              : SessionFormat.audio,
        ),
      ),
      GoRoute(
        path: RoutePaths.sessionPattern,
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-chat:${state.pathParameters['id']}'),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
      callEngineProvider.overrideWithValue(engine),
      permissionServiceProvider.overrideWithValue(permissions),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

Future<void> _teardownTree(WidgetTester tester) =>
    tester.pumpWidget(const SizedBox());

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.audio));

  late MockSqApi api;
  late _FakeCallEngine engine;
  late _FakeSqSocket socket;

  setUp(() {
    api = MockSqApi();
    engine = _FakeCallEngine();
    socket = _FakeSqSocket();
    addTearDown(engine.dispose);
    addTearDown(socket.dispose);
    when(() => api.mediaToken('c1', format: any(named: 'format'))).thenAnswer(
      (_) async => const MediaToken(
        token: 'jwt',
        url: 'wss://livekit.local',
        room: 'consultation-c1',
      ),
    );
    when(
      () => api.consultationById('c1'),
    ).thenAnswer((_) async => _consultation());
    when(
      () => api.consultationMessages(
        'c1',
        cursor: any(named: 'cursor'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer((_) async => const MessageHistory(items: []));
  });

  testWidgets('звонок стартует сам и показывает специалиста и статус', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        api: api,
        engine: engine,
        permissions: _FakePermissionService(),
        socket: socket,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Динара С.'), findsOneWidget);
    expect(find.text('Соединяем…'), findsOneWidget);
    verify(() => api.mediaToken('c1', format: SessionFormat.audio)).called(1);

    engine.push(CallEngineState.connected);
    await tester.pump();
    await tester.pump();
    expect(find.text('На связи'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets('баннер реконнекта показывает формулировку прототипа', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        api: api,
        engine: engine,
        permissions: _FakePermissionService(),
        socket: socket,
      ),
    );
    await tester.pumpAndSettle();

    engine.push(CallEngineState.reconnecting);
    await tester.pump();
    await tester.pump();

    expect(
      find.text('Связь восстанавливается, собеседник останется на линии'),
      findsOneWidget,
    );

    await _teardownTree(tester);
  });

  testWidgets('после 30 с реконнекта предлагается продолжить в чате', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        api: api,
        engine: engine,
        permissions: _FakePermissionService(),
        socket: socket,
      ),
    );
    await tester.pumpAndSettle();

    engine.push(CallEngineState.reconnecting);
    await tester.pump();
    await tester.pump(const Duration(seconds: 30));
    await tester.pump();

    expect(find.text('Связь не восстановилась'), findsOneWidget);

    await tester.tap(find.text('Продолжить в чате'));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-chat:c1'), findsOneWidget);
  });

  testWidgets('отказ в микрофоне даёт объяснение и путь в настройки', (
    tester,
  ) async {
    final permissions = _FakePermissionService(granted: false);
    await tester.pumpWidget(
      _wrap(
        api: api,
        engine: engine,
        permissions: permissions,
        socket: socket,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Нужен доступ к микрофону'), findsOneWidget);
    await tester.tap(find.text('Открыть настройки'));
    await tester.pump();

    expect(permissions.settingsOpened, 1);
    verifyNever(() => api.mediaToken(any(), format: any(named: 'format')));

    await _teardownTree(tester);
  });

  testWidgets('«Завершить» кладёт трубку и возвращает в чат', (tester) async {
    await tester.pumpWidget(
      _wrap(
        api: api,
        engine: engine,
        permissions: _FakePermissionService(),
        socket: socket,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-call-end')));
    await tester.pumpAndSettle();

    expect(engine.disconnects, greaterThanOrEqualTo(1));
    expect(find.text('sq-stub-chat:c1'), findsOneWidget);
    verifyNever(() => api.cancelConsultation(any()));
  });

  testWidgets('кнопка микрофона переключает его через движок', (tester) async {
    await tester.pumpWidget(
      _wrap(
        api: api,
        engine: engine,
        permissions: _FakePermissionService(),
        socket: socket,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-call-mic')));
    await tester.pump();

    expect(engine.micEnabled, isFalse);

    await _teardownTree(tester);
  });
}
