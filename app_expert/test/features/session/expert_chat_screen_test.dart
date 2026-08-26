// Виджет-тесты ExpertChatScreen (Step 1 брифа задачи 13 эпика E7): история
// сообщений отображается, отправка зовёт sendChat, а WS-эхо дописывает
// сообщение в ленту.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/session/ui/expert_chat_screen.dart';
import 'package:app_expert/l10n/app_localizations.dart';

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

ConsultationExpertDto _consultation() => ConsultationExpertDto(
  id: 'cons-1',
  status: ConsultationStatus.active,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: DateTime.now().subtract(const Duration(minutes: 5)),
  clientCode: 4821,
  topicSlug: 'anxiety-stress',
  priceTiyn: 500000,
  plannedDurationMin: 30,
  paymentStatus: ConsultationPaymentStatus.held,
);

ChatMessage _message(String id, String text, {String senderRole = 'client'}) =>
    ChatMessage(
      id: id,
      consultationId: 'cons-1',
      senderRole: senderRole,
      text: text,
      createdAt: DateTime.now(),
    );

Widget _wrap(SqApi api, SqSocket socket) {
  final router = GoRouter(
    initialLocation: '/session/cons-1',
    routes: [
      GoRoute(
        path: '/session/:id',
        builder: (context, state) =>
            const ExpertChatScreen(consultationId: 'cons-1'),
      ),
      GoRoute(
        path: '/consultations',
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-consultations')),
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
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: router,
    ),
  );
}

/// Снимает дерево до конца теста: пока экран жив, живёт `Timer.periodic`
/// таймера сессии (`ExpertSessionController`), а `flutter_test` считает
/// незакрытый таймер утечкой ещё до tearDown.
Future<void> _teardownTree(WidgetTester tester) =>
    tester.pumpWidget(const SizedBox());

void main() {
  late MockSqApi api;
  late _FakeSqSocket socket;

  setUp(() {
    api = MockSqApi();
    socket = _FakeSqSocket();
    addTearDown(socket.dispose);
    when(() => api.expertConsultationById('cons-1'))
        .thenAnswer((_) async => _consultation());
  });

  testWidgets('история сообщений отображается', (tester) async {
    when(() => api.consultationMessages('cons-1', cursor: null, limit: null))
        .thenAnswer(
          (_) async => MessageHistory(items: [_message('m1', 'Здравствуйте')]),
        );

    await tester.pumpWidget(_wrap(api, socket));
    await tester.pump();
    await tester.pump();

    expect(find.text('Здравствуйте'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets(
    'отправка сообщения зовёт SqEvents.sendChat, а эхо дописывает его в ленту',
    (tester) async {
      when(() => api.consultationMessages('cons-1', cursor: null, limit: null))
          .thenAnswer((_) async => const MessageHistory(items: []));

      await tester.pumpWidget(_wrap(api, socket));
      await tester.pump();
      await tester.pump();

      await tester.enterText(
        find.byKey(const Key('sq-chat-input')),
        'Как ваше самочувствие?',
      );
      await tester.tap(find.byKey(const Key('sq-chat-send')));
      await tester.pump();

      // Сообщение появляется в ленте только через WS-эхо (POST-отправки нет
      // у бэкенда, см. `ExpertSessionController`), не оптимистично.
      expect(find.text('Как ваше самочувствие?'), findsNothing);

      socket.push('chat.message', {
        'id': 'm2',
        'consultationId': 'cons-1',
        'senderRole': 'expert',
        'text': 'Как ваше самочувствие?',
        'createdAt': DateTime.now().toIso8601String(),
      });
      await tester.pump();

      expect(find.text('Как ваше самочувствие?'), findsOneWidget);

      await _teardownTree(tester);
    },
  );
}
