// Юнит-тесты SearchController (Step 1 брифа задачи 10): реакция на события
// шины, страховочный поллинг `GET /requests/:id`, счётчик онлайна, отмена.
//
// Тесты живут в `testWidgets`, а не в `test`: контроллер использует
// НАСТОЯЩИЕ `Timer.periodic` (тик секунд, счётчик онлайна раз в 10 с,
// страховочный опрос раз в 15 с), и единственный способ проверить их
// детерминированно — виртуальное время `FakeAsync`, которое `flutter_test`
// даёт через `tester.pump(Duration)`. Урок 3 плана эпика: тест, который
// полагается на то, что операция «успеет», не проверяет ничего.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/features/funnel/state/search_controller.dart';

class MockSqApi extends Mock implements SqApi {}

/// Фейковый транспорт шины: тест сам решает, какое сырое событие и когда
/// приходит от бэкенда. Разбор при этом остаётся настоящим — событие
/// проходит через `SqEvent.fromRaw`, как в бою (урок 5 плана эпика:
/// двойник не должен быть проще оригинала там, где живёт логика).
class _FakeSqSocket implements SqSocket {
  final _events = StreamController<(String, dynamic)>.broadcast();

  void push(String event, dynamic data) => _events.add((event, data));

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

const _args = SearchArgs(
  requestId: 'r1',
  topicSlug: 'anxiety-stress',
  format: SessionFormat.chat,
);

MatchRequest _request(RequestStatus status) => MatchRequest(
  id: 'r1',
  status: status,
  isEmergency: false,
  clientCode: 4821,
);

Map<String, dynamic> _expertJson() => {
  'id': 'e1',
  'displayName': 'Айгуль Т.',
  'city': 'Алматы',
  'experience': 'ONE_TO_THREE',
  'priceTiyn': 500000,
  'languages': ['ru'],
  'formats': ['chat'],
  'topicSlugs': ['anxiety-stress'],
  'workStatus': 'ACCEPTING',
  'ratingAvg': 4.8,
  'ratingCount': 10,
};

/// Собирает контейнер и держит подписку на провайдер — семейство
/// `autoDispose` без слушателя было бы утилизировано сразу после чтения.
///
/// `addTearDown(container.dispose)` тут — только страховка: `flutter_test`
/// проверяет «не осталось живых таймеров» ДО tearDown-колбэков, поэтому
/// тест, который заканчивается в состоянии поиска (таймеры тикают),
/// обязан утилизировать контейнер сам, последней строкой тела — см.
/// `_disposeNow` ниже.
ProviderContainer _container({
  required SqApi api,
  required SqSocket socket,
  SearchArgs args = _args,
}) {
  final container = ProviderContainer(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
    ],
  );
  addTearDown(container.dispose);
  container.listen(
    searchControllerProvider(args),
    (previous, next) {},
    fireImmediately: true,
  );
  return container;
}

/// Утилизирует контейнер прямо в теле теста: пока живёт провайдер, живут и
/// его `Timer.periodic`, а `flutter_test` считает незакрытый таймер утечкой
/// и валит тест ещё до tearDown.
void _disposeNow(ProviderContainer container) => container.dispose();

SearchState _state(ProviderContainer container, [SearchArgs args = _args]) =>
    container.read(searchControllerProvider(args)).requireValue;

void main() {
  setUpAll(() {
    registerFallbackValue(SessionFormat.chat);
  });

  late MockSqApi api;
  late _FakeSqSocket socket;

  setUp(() {
    api = MockSqApi();
    socket = _FakeSqSocket();
    addTearDown(socket.dispose);
    when(() => api.requestById(any()))
        .thenAnswer((_) async => _request(RequestStatus.searching));
    when(
      () => api.onlineCount(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        urgentOnly: any(named: 'urgentOnly'),
      ),
    ).thenAnswer((_) async => const OnlineCount(count: 3));
  });

  testWidgets('событие matched переводит в matched и останавливает тик', (
    tester,
  ) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();
    expect(_state(container).status, RequestStatus.searching);

    await tester.pump(const Duration(seconds: 3));
    expect(_state(container).elapsedSec, 3);

    socket.push('request.updated', {
      'id': 'r1',
      'status': 'MATCHED',
      'consultationId': 'c1',
      'matchedExpert': _expertJson(),
    });
    await tester.pump();

    expect(_state(container).status, RequestStatus.matched);
    expect(_state(container).consultationId, 'c1');
    expect(_state(container).matched?.id, 'e1');

    // Тик остановлен: секунды больше не растут, страховочный опрос больше
    // не ходит в сеть (иначе экран продолжал бы работать после ухода).
    clearInteractions(api);
    await tester.pump(const Duration(seconds: 30));
    expect(_state(container).elapsedSec, 3);
    verifyNever(() => api.requestById(any()));

    _disposeNow(container);
  });

  testWidgets('пропущенное WS-событие: matched приходит страховочным опросом', (
    tester,
  ) async {
    var calls = 0;
    when(() => api.requestById('r1')).thenAnswer((_) async {
      calls++;
      return _request(
        calls == 1 ? RequestStatus.searching : RequestStatus.matched,
      );
    });

    final container = _container(api: api, socket: socket);
    await tester.pump();
    expect(_state(container).status, RequestStatus.searching);

    // В шину не пришло НИЧЕГО — источник истины здесь только REST.
    await tester.pump(const Duration(seconds: 15));
    expect(_state(container).status, RequestStatus.matched);

    _disposeNow(container);
  });

  testWidgets('событие noExperts переводит в noExperts', (tester) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();

    socket.push('request.updated', {'id': 'r1', 'status': 'NO_EXPERTS'});
    await tester.pump();

    expect(_state(container).status, RequestStatus.noExperts);

    _disposeNow(container);
  });

  testWidgets('событие callbackRequested приносит горячие линии', (
    tester,
  ) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();

    socket.push('request.updated', {
      'id': 'r1',
      'status': 'CALLBACK_REQUESTED',
      'hotlines': ['+77172000000'],
    });
    await tester.pump();

    expect(_state(container).status, RequestStatus.callbackRequested);
    expect(_state(container).hotlines, ['+77172000000']);

    _disposeNow(container);
  });

  testWidgets('cancel() зовёт API и переводит в cancelled', (tester) async {
    when(() => api.cancelRequest('r1'))
        .thenAnswer((_) async => _request(RequestStatus.cancelled));

    final container = _container(api: api, socket: socket);
    await tester.pump();

    await container.read(searchControllerProvider(_args).notifier).cancel();
    await tester.pump();

    verify(() => api.cancelRequest('r1')).called(1);
    expect(_state(container).status, RequestStatus.cancelled);

    _disposeNow(container);
  });

  testWidgets('счётчик онлайна обновляется на 10-й секунде, не раньше', (
    tester,
  ) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();
    expect(_state(container).onlineCount, 3);

    when(
      () => api.onlineCount(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        urgentOnly: any(named: 'urgentOnly'),
      ),
    ).thenAnswer((_) async => const OnlineCount(count: 7));

    await tester.pump(const Duration(seconds: 9));
    expect(_state(container).onlineCount, 3);

    await tester.pump(const Duration(seconds: 1));
    expect(_state(container).onlineCount, 7);

    _disposeNow(container);
  });

  testWidgets('событие о ЧУЖОЙ заявке игнорируется', (tester) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();

    socket.push('request.updated', {
      'id': 'r2',
      'status': 'MATCHED',
      'consultationId': 'c-foreign',
      'matchedExpert': _expertJson(),
    });
    await tester.pump();

    expect(_state(container).status, RequestStatus.searching);
    expect(_state(container).consultationId, isNull);

    _disposeNow(container);
  });

  testWidgets('устаревший ответ опроса не отменяет уже полученный matched', (
    tester,
  ) async {
    // Сверх минимума брифа (урок 1): событие о матче и ответ страховочного
    // опроса приходят из разных мест бэкенда, и ответ «ещё ищем»,
    // сформированный ДО матча, вполне может прийти ПОСЛЕ события о матче.
    // Откат matched -> searching здесь означал бы, что клиент, уже уехавший
    // на экран «специалист найден», возвращается обратно в поиск.
    //
    // Гонка воспроизведена затвором, а не таймингом (урок 3): второй вызов
    // `GET /requests/:id` (тот самый опрос на 15-й секунде) висит на
    // `Completer` до тех пор, пока тест не пришлёт событие о матче.
    final gate = Completer<void>();
    var calls = 0;
    when(() => api.requestById('r1')).thenAnswer((_) async {
      calls++;
      if (calls == 1) return _request(RequestStatus.searching);
      await gate.future;
      return _request(RequestStatus.searching);
    });

    final container = _container(api: api, socket: socket);
    await tester.pump();
    expect(_state(container).status, RequestStatus.searching);

    await tester.pump(const Duration(seconds: 15));
    expect(calls, 2, reason: 'страховочный опрос должен был уйти в сеть');

    socket.push('request.updated', {
      'id': 'r1',
      'status': 'MATCHED',
      'consultationId': 'c1',
      'matchedExpert': _expertJson(),
    });
    await tester.pump();
    expect(_state(container).status, RequestStatus.matched);

    gate.complete();
    await tester.pump();

    expect(_state(container).status, RequestStatus.matched);
    expect(_state(container).consultationId, 'c1');

    _disposeNow(container);
  });

  testWidgets('сбой счётчика онлайна не роняет экран и сохраняет прошлое значение', (
    tester,
  ) async {
    final container = _container(api: api, socket: socket);
    await tester.pump();
    expect(_state(container).onlineCount, 3);

    when(
      () => api.onlineCount(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        urgentOnly: any(named: 'urgentOnly'),
      ),
    ).thenThrow(const ApiException(ApiErrorCode.network, 'нет сети', 0));

    await tester.pump(const Duration(seconds: 10));

    expect(container.read(searchControllerProvider(_args)).hasError, isFalse);
    expect(_state(container).onlineCount, 3);
    expect(_state(container).status, RequestStatus.searching);

    _disposeNow(container);
  });

  testWidgets('без topicSlug/format счётчик не запрашивается вовсе', (
    tester,
  ) async {
    // Экран поиска, открытый по прямой ссылке/восстановлением, знает только
    // requestId: тема и формат приходят через `extra` роутера и их может не
    // быть. Счётчик в этом случае просто отсутствует, а не ломает экран.
    const args = SearchArgs(requestId: 'r1');
    final container = _container(api: api, socket: socket, args: args);
    await tester.pump();

    expect(_state(container, args).onlineCount, isNull);
    await tester.pump(const Duration(seconds: 10));
    verifyNever(
      () => api.onlineCount(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        urgentOnly: any(named: 'urgentOnly'),
      ),
    );

    _disposeNow(container);
  });
}
