// Юнит-тесты CallController (Step 1 брифа задачи 14) на фейковом движке
// звонка и моке API: разрешения, токен, подключение, реконнект и отказы.
//
// `CallEngine` — абстракция именно ради этих тестов: `livekit_client` тянет
// платформенные каналы и в headless `flutter test` не поднимается.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

class MockSqApi extends Mock implements SqApi {}

/// Фейковый движок: тест сам решает, какие состояния соединения приходят и
/// когда, и видит все вызовы управления медиа.
class _FakeCallEngine implements CallEngine {
  final _states = StreamController<CallEngineState>.broadcast();
  final List<(String url, String token)> connects = [];
  int disconnects = 0;
  bool? micEnabled;
  bool? camEnabled;

  void push(CallEngineState state) => _states.add(state);

  @override
  Stream<CallEngineState> get states => _states.stream;

  @override
  Future<void> connect(String url, String token) async =>
      connects.add((url, token));

  @override
  Future<void> disconnect() async => disconnects++;

  @override
  Future<void> setMicEnabled(bool enabled) async => micEnabled = enabled;

  @override
  Future<void> setCamEnabled(bool enabled) async => camEnabled = enabled;

  Future<void> dispose() => _states.close();
}

/// Фейк разрешений: тест задаёт исход для каждого разрешения.
class _FakePermissionService implements PermissionService {
  _FakePermissionService({this.granted = const {}});

  final Map<SqPermission, bool> granted;
  final List<SqPermission> asked = [];
  int settingsOpened = 0;

  @override
  Future<void> request(SqPermission permission) async {
    asked.add(permission);
  }

  @override
  Future<bool> ensure(SqPermission permission) async {
    asked.add(permission);
    return granted[permission] ?? true;
  }

  @override
  Future<void> openSettings() async => settingsOpened++;
}

const _token = MediaToken(
  token: 'jwt-token',
  url: 'wss://livekit.local',
  room: 'consultation-c1',
);

ProviderContainer _container({
  required SqApi api,
  required CallEngine engine,
  required PermissionService permissions,
}) {
  final container = ProviderContainer(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      callEngineProvider.overrideWithValue(engine),
      permissionServiceProvider.overrideWithValue(permissions),
    ],
  );
  addTearDown(container.dispose);
  container.listen(
    callControllerProvider('c1'),
    (previous, next) {},
    fireImmediately: true,
  );
  return container;
}

CallState _state(ProviderContainer container) =>
    container.read(callControllerProvider('c1'));

void _disposeNow(ProviderContainer container) => container.dispose();

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.audio));

  late MockSqApi api;
  late _FakeCallEngine engine;

  setUp(() {
    api = MockSqApi();
    engine = _FakeCallEngine();
    addTearDown(engine.dispose);
    when(
      () => api.mediaToken('c1', format: any(named: 'format')),
    ).thenAnswer((_) async => _token);
  });

  testWidgets('видеозвонок просит оба разрешения, берёт токен и подключается', (
    tester,
  ) async {
    final permissions = _FakePermissionService();
    final container = _container(
      api: api,
      engine: engine,
      permissions: permissions,
    );

    await container
        .read(callControllerProvider('c1').notifier)
        .start(SessionFormat.video);
    await tester.pump();

    expect(permissions.asked, [SqPermission.microphone, SqPermission.camera]);
    verify(() => api.mediaToken('c1', format: SessionFormat.video)).called(1);
    expect(engine.connects, [('wss://livekit.local', 'jwt-token')]);
    expect(_state(container).phase, CallPhase.connecting);
    expect(_state(container).format, SessionFormat.video);

    _disposeNow(container);
  });

  testWidgets('отказ в микрофоне не даёт даже запросить токен', (tester) async {
    final permissions = _FakePermissionService(
      granted: {SqPermission.microphone: false},
    );
    final container = _container(
      api: api,
      engine: engine,
      permissions: permissions,
    );

    await container
        .read(callControllerProvider('c1').notifier)
        .start(SessionFormat.audio);
    await tester.pump();

    expect(_state(container).phase, CallPhase.permissionDenied);
    verifyNever(() => api.mediaToken(any(), format: any(named: 'format')));
    expect(engine.connects, isEmpty);

    _disposeNow(container);
  });

  testWidgets('отказ в камере понижает видео до аудио, а не роняет звонок', (
    tester,
  ) async {
    // Микрофон есть — говорить можно; терять из-за камеры весь звонок
    // посреди консультации было бы хуже, чем начать его без картинки.
    final permissions = _FakePermissionService(
      granted: {SqPermission.camera: false},
    );
    final container = _container(
      api: api,
      engine: engine,
      permissions: permissions,
    );

    await container
        .read(callControllerProvider('c1').notifier)
        .start(SessionFormat.video);
    await tester.pump();

    verify(() => api.mediaToken('c1', format: SessionFormat.audio)).called(1);
    expect(_state(container).format, SessionFormat.audio);
    expect(_state(container).phase, CallPhase.connecting);
    expect(_state(container).cameraBlocked, isTrue);

    _disposeNow(container);
  });

  testWidgets('состояния движка переводят звонок в connected и обратно', (
    tester,
  ) async {
    final container = _container(
      api: api,
      engine: engine,
      permissions: _FakePermissionService(),
    );
    await container
        .read(callControllerProvider('c1').notifier)
        .start(SessionFormat.audio);
    await tester.pump();

    engine.push(CallEngineState.connected);
    await tester.pump();
    expect(_state(container).phase, CallPhase.connected);

    engine.push(CallEngineState.reconnecting);
    await tester.pump();
    expect(_state(container).phase, CallPhase.reconnecting);

    engine.push(CallEngineState.connected);
    await tester.pump();
    expect(_state(container).phase, CallPhase.connected);
    expect(_state(container).offerChatFallback, isFalse);

    _disposeNow(container);
  });

  testWidgets('реконнект дольше 30 с предлагает продолжить в чате', (
    tester,
  ) async {
    final container = _container(
      api: api,
      engine: engine,
      permissions: _FakePermissionService(),
    );
    await container
        .read(callControllerProvider('c1').notifier)
        .start(SessionFormat.audio);
    await tester.pump();
    engine.push(CallEngineState.connected);
    await tester.pump();

    engine.push(CallEngineState.reconnecting);
    await tester.pump();

    await tester.pump(const Duration(seconds: 29));
    expect(_state(container).phase, CallPhase.reconnecting);

    await tester.pump(const Duration(seconds: 1));
    expect(_state(container).phase, CallPhase.failed);
    expect(_state(container).offerChatFallback, isTrue);

    _disposeNow(container);
  });

  testWidgets('успевший вернуться реконнект таймер снимает', (tester) async {
    final container = _container(
      api: api,
      engine: engine,
      permissions: _FakePermissionService(),
    );
    await container
        .read(callControllerProvider('c1').notifier)
        .start(SessionFormat.audio);
    await tester.pump();

    engine.push(CallEngineState.reconnecting);
    await tester.pump();
    await tester.pump(const Duration(seconds: 20));
    engine.push(CallEngineState.connected);
    await tester.pump();

    await tester.pump(const Duration(seconds: 30));
    expect(_state(container).phase, CallPhase.connected);
    expect(_state(container).offerChatFallback, isFalse);

    _disposeNow(container);
  });

  testWidgets('CONSULTATION_NOT_ACTIVE от media-token даёт failed', (
    tester,
  ) async {
    when(() => api.mediaToken('c1', format: any(named: 'format'))).thenThrow(
      const ApiException(
        ApiErrorCode.consultationNotActive,
        'not active',
        409,
      ),
    );

    final container = _container(
      api: api,
      engine: engine,
      permissions: _FakePermissionService(),
    );
    await container
        .read(callControllerProvider('c1').notifier)
        .start(SessionFormat.audio);
    await tester.pump();

    expect(_state(container).phase, CallPhase.failed);
    expect(_state(container).errorCode, ApiErrorCode.consultationNotActive);
    expect(engine.connects, isEmpty);

    _disposeNow(container);
  });

  testWidgets('эскалация аудио -> видео берёт новый токен тем же вызовом', (
    tester,
  ) async {
    final container = _container(
      api: api,
      engine: engine,
      permissions: _FakePermissionService(),
    );
    final notifier = container.read(callControllerProvider('c1').notifier);

    await notifier.start(SessionFormat.audio);
    await tester.pump();
    engine.push(CallEngineState.connected);
    await tester.pump();

    await notifier.start(SessionFormat.video);
    await tester.pump();

    verify(() => api.mediaToken('c1', format: SessionFormat.video)).called(1);
    expect(_state(container).format, SessionFormat.video);
    expect(engine.connects.length, 2);

    _disposeNow(container);
  });

  testWidgets('«Завершить» отключает медиа, но исход не фиксирует', (
    tester,
  ) async {
    // Исход консультации фиксирует эксперт (БП-03) — клиентский «Завершить»
    // обязан только положить трубку.
    final container = _container(
      api: api,
      engine: engine,
      permissions: _FakePermissionService(),
    );
    final notifier = container.read(callControllerProvider('c1').notifier);
    await notifier.start(SessionFormat.audio);
    await tester.pump();

    await notifier.hangUp();
    await tester.pump();

    expect(engine.disconnects, 1);
    expect(_state(container).phase, CallPhase.disconnected);
    verifyNever(() => api.cancelConsultation(any()));

    _disposeNow(container);
  });

  testWidgets('микрофон и камера переключаются через движок', (tester) async {
    final container = _container(
      api: api,
      engine: engine,
      permissions: _FakePermissionService(),
    );
    final notifier = container.read(callControllerProvider('c1').notifier);
    await notifier.start(SessionFormat.video);
    await tester.pump();

    await notifier.toggleMic();
    await tester.pump();
    expect(engine.micEnabled, isFalse);
    expect(_state(container).micEnabled, isFalse);

    await notifier.toggleCam();
    await tester.pump();
    expect(engine.camEnabled, isFalse);
    expect(_state(container).camEnabled, isFalse);

    _disposeNow(container);
  });
}
