// Виджет-тесты экстренного варианта экрана поиска (Step 1 брифа задачи 11,
// прототип `16-emergency.png`): бейдж «Приоритетный поиск» и кнопка вызова
// служб, которая обязана оставаться на экране при скролле (требование
// БП-02 — она не должна уезжать вместе с содержимым).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/core/url_launcher_port.dart';
import 'package:app_client/features/funnel/state/search_controller.dart';
import 'package:app_client/features/funnel/ui/search_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

class _FakeUrlLauncherPort implements UrlLauncherPort {
  final List<String> launched = [];

  @override
  Future<void> launch(String url) async => launched.add(url);
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

const _emergencyArgs = SearchArgs(
  requestId: 'r1',
  topicSlug: 'other',
  format: SessionFormat.chat,
  isEmergency: true,
);

const _plainArgs = SearchArgs(
  requestId: 'r1',
  topicSlug: 'anxiety-stress',
  format: SessionFormat.chat,
);

Widget _wrap({
  required SqApi api,
  required SqSocket socket,
  required SearchArgs args,
  required UrlLauncherPort launcher,
}) {
  final router = GoRouter(
    initialLocation: RoutePaths.search(args.requestId),
    routes: [
      GoRoute(
        path: RoutePaths.searchPattern,
        builder: (context, state) => SearchScreen(args: args),
      ),
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-home')),
      ),
      GoRoute(
        path: RoutePaths.foundPattern,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-found')),
      ),
      GoRoute(
        path: RoutePaths.emergencyHotlines,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-hotlines')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
      urlLauncherPortProvider.overrideWithValue(launcher),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.chat));

  late MockSqApi api;
  late _FakeSqSocket socket;
  late _FakeUrlLauncherPort launcher;

  setUp(() {
    api = MockSqApi();
    socket = _FakeSqSocket();
    launcher = _FakeUrlLauncherPort();
    addTearDown(socket.dispose);
    when(() => api.requestById(any())).thenAnswer(
      (_) async => const MatchRequest(
        id: 'r1',
        status: RequestStatus.searching,
        isEmergency: true,
        clientCode: 7301,
      ),
    );
    when(
      () => api.onlineCount(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        urgentOnly: any(named: 'urgentOnly'),
      ),
    ).thenAnswer((_) async => const OnlineCount(count: 2));
  });

  testWidgets('экстренный поиск показывает бейдж и кнопку вызова служб', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(api: api, socket: socket, args: _emergencyArgs, launcher: launcher),
    );
    await tester.pump();

    expect(find.text('Приоритетный поиск'), findsOneWidget);
    expect(find.text('Ищем свободного специалиста для вас'), findsOneWidget);
    expect(find.text('Позвонить 103 / 112'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('кнопка вызова служб остаётся видимой после скролла', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(api: api, socket: socket, args: _emergencyArgs, launcher: launcher),
    );
    await tester.pump();

    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pump();

    // `hitTestable` — именно то, что требует БП-02: кнопка не просто есть в
    // дереве, а доступна для тапа на экране, не уехав вместе со скроллом.
    expect(
      find.text('Позвонить 103 / 112').hitTestable(),
      findsOneWidget,
      reason: 'кнопка вызова служб не должна скроллиться вместе с содержимым',
    );

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('кнопка вызова служб звонит на tel:103', (tester) async {
    await tester.pumpWidget(
      _wrap(api: api, socket: socket, args: _emergencyArgs, launcher: launcher),
    );
    await tester.pump();

    await tester.tap(find.text('Позвонить 103 / 112'));
    await tester.pump();

    expect(launcher.launched, ['tel:103']);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('обычный поиск не показывает ни бейджа, ни кнопки служб', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(api: api, socket: socket, args: _plainArgs, launcher: launcher),
    );
    await tester.pump();

    expect(find.text('Приоритетный поиск'), findsNothing);
    expect(find.text('Позвонить 103 / 112'), findsNothing);
    expect(
      find.text('Подбираем для вас подходящего психолога'),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('экстренный поиск считает только принимающих экстренные заявки', (
    tester,
  ) async {
    // Р-16: счётчик на экстренном экране обязан спрашивать бэкенд с
    // urgentOnly=true, иначе он покажет специалистов, которые экстренные
    // заявки не берут.
    await tester.pumpWidget(
      _wrap(api: api, socket: socket, args: _emergencyArgs, launcher: launcher),
    );
    await tester.pump();

    verify(
      () => api.onlineCount(
        topicSlug: 'other',
        format: SessionFormat.chat,
        urgentOnly: true,
      ),
    ).called(1);

    await tester.pumpWidget(const SizedBox());
  });
}
