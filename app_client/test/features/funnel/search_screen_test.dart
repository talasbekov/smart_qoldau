// Виджет-тесты SearchScreen (Step 2 брифа задачи 10): счётчик онлайна,
// растущий таймер, кнопка отмены, ветка «нет свободных специалистов» и
// терминальные переходы (matched -> /found, cancelled -> /home,
// callbackRequested -> /emergency/hotlines).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/funnel/state/search_controller.dart';
import 'package:app_client/features/funnel/ui/search_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

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

Widget _wrap({
  required SqApi api,
  required SqSocket socket,
  SearchArgs args = _args,
}) {
  final router = GoRouter(
    initialLocation: RoutePaths.search(args.requestId),
    routes: [
      GoRoute(
        path: RoutePaths.searchPattern,
        builder: (context, state) => SearchScreen(args: args),
      ),
      GoRoute(
        path: RoutePaths.foundPattern,
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-found:${state.pathParameters['requestId']}'),
        ),
      ),
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-home')),
      ),
      GoRoute(
        path: RoutePaths.emergencyHotlines,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-hotlines')),
      ),
      GoRoute(
        path: RoutePaths.topic,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-topic')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

/// Снимает дерево до конца теста: пока экран жив, живут его `Timer.periodic`,
/// а `flutter_test` проверяет «не осталось таймеров» ещё до tearDown.
Future<void> _teardownTree(WidgetTester tester) =>
    tester.pumpWidget(const SizedBox());

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.chat));

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

  testWidgets('показывает счётчик онлайна, таймер и кнопку отмены', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pump();

    expect(
      find.text('Подбираем для вас подходящего психолога'),
      findsOneWidget,
    );
    expect(find.text('Сейчас онлайн: 3 специалиста'), findsOneWidget);
    expect(find.text('00:00'), findsOneWidget);
    expect(find.text('Отменить поиск'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets('таймер растёт раз в секунду', (tester) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pump();

    await tester.pump(const Duration(seconds: 5));
    expect(find.text('00:05'), findsOneWidget);

    await tester.pump(const Duration(seconds: 60));
    expect(find.text('01:05'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets('без темы и формата строка счётчика не показывается вовсе', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        api: api,
        socket: socket,
        args: const SearchArgs(requestId: 'r1'),
      ),
    );
    await tester.pump();

    expect(find.textContaining('Сейчас онлайн'), findsNothing);
    expect(find.text('Отменить поиск'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets('состояние noExperts показывает экран с двумя кнопками', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pump();

    socket.push('request.updated', {'id': 'r1', 'status': 'NO_EXPERTS'});
    await tester.pump();

    expect(find.text('Сейчас нет свободных специалистов'), findsOneWidget);
    expect(find.text('Попробовать снова'), findsOneWidget);
    expect(find.text('На главную'), findsOneWidget);
    expect(find.text('Отменить поиск'), findsNothing);

    await _teardownTree(tester);
  });

  testWidgets('«На главную» с экрана noExperts ведёт на главную', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pump();
    socket.push('request.updated', {'id': 'r1', 'status': 'NO_EXPERTS'});
    await tester.pump();

    await tester.tap(find.text('На главную'));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-home'), findsOneWidget);
  });

  testWidgets('matched уводит на экран «специалист найден»', (tester) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pump();

    socket.push('request.updated', {
      'id': 'r1',
      'status': 'MATCHED',
      'consultationId': 'c1',
      'matchedExpert': _expertJson(),
    });
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-found:r1'), findsOneWidget);
  });

  testWidgets('«Отменить поиск» отменяет заявку и возвращает на главную', (
    tester,
  ) async {
    when(() => api.cancelRequest('r1'))
        .thenAnswer((_) async => _request(RequestStatus.cancelled));

    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pump();

    await tester.tap(find.text('Отменить поиск'));
    await tester.pumpAndSettle();

    verify(() => api.cancelRequest('r1')).called(1);
    expect(find.text('sq-stub-home'), findsOneWidget);
  });

  testWidgets('callbackRequested уводит на горячие линии', (tester) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pump();

    socket.push('request.updated', {
      'id': 'r1',
      'status': 'CALLBACK_REQUESTED',
      'hotlines': ['+77172000000'],
    });
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-hotlines'), findsOneWidget);
  });

  testWidgets('сбой загрузки заявки даёт SqErrorView с рабочим «Повторить»', (
    tester,
  ) async {
    // Урок 8 плана эпика: сбой механизма — аварийный исход, у пользователя
    // должен остаться выход, а не немой экран.
    var calls = 0;
    when(() => api.requestById('r1')).thenAnswer((_) async {
      calls++;
      if (calls == 1) {
        throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
      }
      return _request(RequestStatus.searching);
    });

    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pump();

    expect(find.text('Нет соединения с сервером'), findsOneWidget);

    await tester.tap(find.text('Повторить'));
    await tester.pump();
    await tester.pump();

    expect(find.text('Отменить поиск'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets('сбой отмены не оставляет кнопку в вечном спиннере', (
    tester,
  ) async {
    // Урок 4 плана эпика: флаг занятости обязан сниматься и на исключении.
    when(() => api.cancelRequest('r1'))
        .thenThrow(const ApiException(ApiErrorCode.network, 'нет сети', 0));

    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pump();

    await tester.tap(find.text('Отменить поиск'));
    await tester.pump();
    await tester.pump();

    expect(find.text('Отменить поиск'), findsOneWidget);
    expect(find.text('Нет соединения с сервером'), findsOneWidget);

    await _teardownTree(tester);
  });
}
