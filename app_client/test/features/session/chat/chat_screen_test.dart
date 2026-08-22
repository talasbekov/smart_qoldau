// Виджет-тесты экрана чата (Step 2 брифа задачи 13): пузыри собеседников,
// индикатор набора, блокировка ввода после завершения и таймер в шапке.
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
import 'package:app_client/features/session/chat/ui/chat_screen.dart';
import 'package:app_client/features/session/chat/ui/message_bubble.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

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
  Duration elapsed = const Duration(minutes: 10),
}) => ClientConsultation(
  id: 'c1',
  status: status,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: DateTime.now().subtract(elapsed),
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: ConsultationPaymentStatus.held,
  expert: _expert(),
);

ChatMessage _message(String id, String role, String text) => ChatMessage(
  id: id,
  consultationId: 'c1',
  senderRole: role,
  text: text,
  createdAt: DateTime.now(),
);

Widget _wrap({
  required SqApi api,
  required SqSocket socket,
  SharedPreferences? prefs,
}) {
  final router = GoRouter(
    initialLocation: RoutePaths.session('c1'),
    routes: [
      GoRoute(
        path: RoutePaths.sessionPattern,
        builder: (context, state) =>
            ChatScreen(consultationId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-home')),
      ),
      GoRoute(
        path: RoutePaths.supportNew,
        builder: (context, state) => Scaffold(
          body: Text(
            'sq-stub-new-ticket:${state.uri.queryParameters['consultationId']}',
          ),
        ),
      ),
      GoRoute(
        path: RoutePaths.reviewPattern,
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-review:${state.pathParameters['id']}'),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
      if (prefs != null) sharedPreferencesProvider.overrideWithValue(prefs),
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
  late MockSqApi api;
  late _FakeSqSocket socket;

  setUp(() {
    api = MockSqApi();
    socket = _FakeSqSocket();
    addTearDown(socket.dispose);
    when(
      () => api.consultationById('c1'),
    ).thenAnswer((_) async => _consultation());
    when(
      () => api.consultationMessages(
        'c1',
        cursor: any(named: 'cursor'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => MessageHistory(
        items: [
          _message('m1', 'expert', 'Здравствуйте!'),
          _message('m2', 'client', 'Здравствуйте'),
        ],
      ),
    );
  });

  testWidgets('пузыри клиента и специалиста различаются выравниванием', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pumpAndSettle();

    final bubbles = tester
        .widgetList<MessageBubble>(find.byType(MessageBubble))
        .toList();
    expect(bubbles.length, 2);
    expect(bubbles.first.isMine, isFalse);
    expect(bubbles.last.isMine, isTrue);

    final expertAlign = tester.getTopLeft(find.text('Здравствуйте!')).dx;
    final clientAlign = tester.getTopLeft(find.text('Здравствуйте')).dx;
    expect(
      clientAlign,
      greaterThan(expertAlign),
      reason: 'своё сообщение прижимается вправо, чужое — влево',
    );

    await _teardownTree(tester);
  });

  testWidgets('в шапке видно имя специалиста и оставшееся время', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pumpAndSettle();

    expect(find.text('Динара С.'), findsOneWidget);
    expect(find.textContaining('Осталось 39:'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets('истёкшее время показывается словами, а не отрицательным', (
    tester,
  ) async {
    when(() => api.consultationById('c1')).thenAnswer(
      (_) async => _consultation(elapsed: const Duration(minutes: 51)),
    );

    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pumpAndSettle();

    expect(find.text('Время консультации истекло'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets('индикатор набора виден, пока собеседник печатает', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pumpAndSettle();

    expect(find.text('печатает…'), findsNothing);

    socket.push('chat.typing', {
      'consultationId': 'c1',
      'senderRole': 'expert',
    });
    // Два кадра: первый доставляет событие из потока в контроллер, второй
    // перерисовывает экран новым состоянием.
    await tester.pump();
    await tester.pump();
    expect(find.text('печатает…'), findsOneWidget);

    await tester.pump(const Duration(seconds: 3));
    expect(find.text('печатает…'), findsNothing);

    await _teardownTree(tester);
  });

  testWidgets('отправка уходит в сокет и рисует пузырь «отправляется»', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'мне тревожно');
    await tester.tap(find.byKey(const Key('sq-chat-send')));
    await tester.pump();

    expect(socket.emitted.where((e) => e.$1 == 'chat.send').length, 1);
    expect(find.text('мне тревожно'), findsOneWidget);
    expect(find.text('отправляется'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets(
    'уже завершённая консультация открывается как чат: ввод заблокирован, '
    'но на оценку экран не уводит (её открывают из истории, задача 17)',
    (tester) async {
      when(() => api.consultationById('c1')).thenAnswer(
        (_) async => _consultation(status: ConsultationStatus.completed),
      );

      await tester.pumpWidget(_wrap(api: api, socket: socket));
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsNothing);
      expect(
        find.text('Консультация завершена — писать больше нельзя'),
        findsOneWidget,
      );

      await _teardownTree(tester);
    },
  );

  testWidgets('отмена консультации подтверждается и возвращает на главную', (
    tester,
  ) async {
    when(() => api.cancelConsultation('c1')).thenAnswer(
      (_) async => _consultation(status: ConsultationStatus.cancelled),
    );

    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-session-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Отменить консультацию'));
    await tester.pumpAndSettle();

    expect(find.text('Время освободится для другого пользователя'), findsOneWidget);

    await tester.tap(find.text('Отменить консультацию').last);
    await tester.pumpAndSettle();

    verify(() => api.cancelConsultation('c1')).called(1);
    expect(find.text('sq-stub-home'), findsOneWidget);
  });

  testWidgets('завершение консультации уводит на экран оценки', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(_wrap(api: api, socket: socket, prefs: prefs));
    await tester.pumpAndSettle();

    socket.push('consultation.updated', {'id': 'c1', 'status': 'COMPLETED'});
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-review:c1'), findsOneWidget);
  });

  testWidgets('уже оценённая консультация оценку повторно не предлагает', (
    tester,
  ) async {
    // Оценка предлагается один раз (бриф задачи 15): флаг ставится и при
    // отправке, и при «Пропустить».
    SharedPreferences.setMockInitialValues({'sq.reviewed.c1': true});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(_wrap(api: api, socket: socket, prefs: prefs));
    await tester.pumpAndSettle();

    socket.push('consultation.updated', {'id': 'c1', 'status': 'COMPLETED'});
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-review:c1'), findsNothing);
    expect(find.text('sq-stub-home'), findsOneWidget);
  });

  testWidgets('отменённая консультация уводит на главную, а не на оценку', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(_wrap(api: api, socket: socket, prefs: prefs));
    await tester.pumpAndSettle();

    socket.push('consultation.updated', {'id': 'c1', 'status': 'CANCELLED'});
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-home'), findsOneWidget);
  });

  testWidgets('«Сообщить о проблеме» открывает обращение по этой консультации', (
    tester,
  ) async {
    // Задача 19: обращение создаётся с привязкой к консультации, иначе
    // поддержке пришлось бы выяснять, о какой именно сессии речь.
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-session-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Сообщить о проблеме'));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-new-ticket:c1'), findsOneWidget);
  });

  testWidgets('плашка о конфиденциальности видна над перепиской', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api: api, socket: socket));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Здесь безопасно говорить открыто. Все сообщения конфиденциальны',
      ),
      findsOneWidget,
    );

    await _teardownTree(tester);
  });
}
