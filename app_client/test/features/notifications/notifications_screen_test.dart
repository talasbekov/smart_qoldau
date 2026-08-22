// Виджет-тесты центра уведомлений (Step 2 брифа задачи 18): бейдж
// непрочитанных, дип-линк тайла и устойчивость к незнакомому типу.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/core/providers.dart';
import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/notifications/ui/notifications_screen.dart';
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

AppNotification _notification({
  required String id,
  required String type,
  Map<String, dynamic> data = const {},
  DateTime? readAt,
  String title = 'Заголовок',
}) => AppNotification(
  id: id,
  type: type,
  title: title,
  body: 'Текст уведомления',
  data: data,
  readAt: readAt,
  createdAt: DateTime(2026, 8, 22, 10),
);

Future<Widget> _wrap(SqApi api, {SqSocket? socket}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();

  final router = GoRouter(
    initialLocation: RoutePaths.notifications,
    routes: [
      GoRoute(
        path: RoutePaths.notifications,
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: RoutePaths.sessionPattern,
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-session:${state.pathParameters['id']}'),
        ),
      ),
      GoRoute(
        path: RoutePaths.consultations,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-consultations')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket ?? _FakeSqSocket())),
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
    when(
      () => api.markNotificationsRead(ids: any(named: 'ids')),
    ).thenAnswer((_) async {});
  });

  testWidgets('пустой центр показывает своё состояние', (tester) async {
    when(
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer((_) async => const NotificationsPage(items: [], unreadCount: 0));

    await tester.pumpWidget(await _wrap(api, socket: socket));
    await tester.pumpAndSettle();

    expect(find.text('Уведомлений пока нет'), findsOneWidget);
  });

  testWidgets('тайл chat.message уводит в сессию и помечает прочитанным', (
    tester,
  ) async {
    when(
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer(
      (_) async => NotificationsPage(
        items: [
          _notification(
            id: 'n1',
            type: 'chat.message',
            data: const {'consultationId': 'c1'},
            title: 'Психолог ответил',
          ),
        ],
        unreadCount: 1,
      ),
    );

    await tester.pumpWidget(await _wrap(api, socket: socket));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Психолог ответил'));
    await tester.pumpAndSettle();

    verify(() => api.markNotificationsRead(ids: ['n1'])).called(1);
    expect(find.text('sq-stub-session:c1'), findsOneWidget);
  });

  testWidgets('тайл consultation.cancelled ведёт в раздел консультаций', (
    tester,
  ) async {
    when(
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer(
      (_) async => NotificationsPage(
        items: [
          _notification(
            id: 'n2',
            type: 'consultation.cancelled',
            title: 'Консультация отменена',
          ),
        ],
        unreadCount: 1,
      ),
    );

    await tester.pumpWidget(await _wrap(api, socket: socket));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Консультация отменена'));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-consultations'), findsOneWidget);
  });

  testWidgets('незнакомый тип рисуется и не роняет список', (tester) async {
    // Экспертные типы (`offer.incoming`, `payout.*`) клиенту не приходят, но
    // рассинхрон с бэкендом не должен ронять центр уведомлений.
    when(
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer(
      (_) async => NotificationsPage(
        items: [
          _notification(
            id: 'n3',
            type: 'payout.updated',
            title: 'Незнакомый тип',
          ),
          _notification(
            id: 'n4',
            type: 'chat.message',
            data: const {'consultationId': 'c1'},
            title: 'Обычный тип',
          ),
        ],
        unreadCount: 2,
      ),
    );

    await tester.pumpWidget(await _wrap(api, socket: socket));
    await tester.pumpAndSettle();

    expect(find.text('Незнакомый тип'), findsOneWidget);
    expect(find.text('Обычный тип'), findsOneWidget);

    // Тап по тайлу без маршрута не роняет экран и просто отмечает прочтение.
    await tester.tap(find.text('Незнакомый тип'));
    await tester.pumpAndSettle();

    verify(() => api.markNotificationsRead(ids: ['n3'])).called(1);
    expect(find.text('Незнакомый тип'), findsOneWidget);
  });

  testWidgets('«Прочитать все» обнуляет непрочитанные', (tester) async {
    when(
      () => api.notifications(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer(
      (_) async => NotificationsPage(
        items: [_notification(id: 'n1', type: 'chat.message')],
        unreadCount: 1,
      ),
    );

    await tester.pumpWidget(await _wrap(api, socket: socket));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-notifications-read-all')));
    await tester.pumpAndSettle();

    verify(() => api.markNotificationsRead(ids: null)).called(1);
  });
}
