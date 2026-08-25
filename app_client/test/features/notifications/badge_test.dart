// Виджет-тест бейджа непрочитанных на главной (Step 2 брифа задачи 18).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/home/ui/home_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

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

Future<Widget> _wrap(SqApi api, SqSocket socket) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();

  final router = GoRouter(
    initialLocation: RoutePaths.home,
    routes: [
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: RoutePaths.notifications,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-notifications')),
      ),
      GoRoute(
        path: RoutePaths.emergency,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-emergency')),
      ),
      GoRoute(
        path: RoutePaths.topic,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-topic')),
      ),
      GoRoute(
        path: RoutePaths.sessionPattern,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-session')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
      sharedPreferencesProvider.overrideWithValue(prefs),
      systemLocaleProvider.overrideWithValue(const Locale('ru')),
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
  late MockSqApi api;
  late _FakeSqSocket socket;

  setUp(() {
    api = MockSqApi();
    socket = _FakeSqSocket();
    addTearDown(socket.dispose);
    when(() => api.topics(locale: any(named: 'locale'))).thenAnswer(
      (_) async => const [
        Topic(id: 't1', slug: 'anxiety-stress', name: 'Тревога и стресс'),
      ],
    );
    when(
      () => api.consultations(
        status: any(named: 'status'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => []);
  });

  testWidgets('бейдж показывает число непрочитанных', (tester) async {
    when(
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer((_) async => const NotificationsPage(items: [], unreadCount: 3));

    await tester.pumpWidget(await _wrap(api, socket));
    await tester.pumpAndSettle();

    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('при нуле непрочитанных бейджа нет', (tester) async {
    when(
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer((_) async => const NotificationsPage(items: [], unreadCount: 0));

    await tester.pumpWidget(await _wrap(api, socket));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('sq-home-notifications-badge')), findsNothing);
  });

  testWidgets('значок уведомлений открывает центр уведомлений', (tester) async {
    when(
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer((_) async => const NotificationsPage(items: [], unreadCount: 0));

    await tester.pumpWidget(await _wrap(api, socket));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-home-notifications-button')));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-notifications'), findsOneWidget);
  });

  testWidgets('сбой центра уведомлений не ломает главный экран', (
    tester,
  ) async {
    // Бейдж — дополнение, а не содержимое главной: недоступный центр
    // уведомлений не должен превращать главный экран в экран ошибки.
    when(
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer(
      (_) async => throw const ApiException(ApiErrorCode.network, 'нет сети', 0),
    );

    await tester.pumpWidget(await _wrap(api, socket));
    await tester.pumpAndSettle();

    expect(find.text('Тревога и стресс'), findsOneWidget);
    expect(find.byKey(const Key('sq-home-notifications-badge')), findsNothing);
  });
}
