// Тест аналитики воронки (Step 2 брифа задачи 24): прохождение
// тема -> формат -> заявка -> матч порождает ровно четыре события ТЗ §10
// в ожидаемом порядке.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/analytics_provider.dart';
import 'package:app_client/core/providers.dart';
import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/funnel/state/search_controller.dart';
import 'package:app_client/features/funnel/ui/search_screen.dart';
import 'package:app_client/features/funnel/ui/topic_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

class _RecordingAnalytics implements AnalyticsPort {
  final List<AnalyticsEvent> events = [];
  final List<String> identified = [];

  @override
  Future<void> track(AnalyticsEvent event) async => events.add(event);

  @override
  Future<void> identify(String distinctId, {required bool isGuest}) async =>
      identified.add(distinctId);
}

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

Map<String, dynamic> _expertJson() => {
  'id': 'e1',
  'displayName': 'Динара С.',
  'city': 'Алматы',
  'experience': 'ONE_TO_THREE',
  'priceTiyn': 399000,
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
  required AnalyticsPort analytics,
}) {
  final router = GoRouter(
    initialLocation: '${RoutePaths.topic}?slug=anxiety-stress',
    routes: [
      GoRoute(
        path: RoutePaths.topic,
        builder: (context, state) => const TopicScreen(
          slug: 'anxiety-stress',
          topicName: 'Тревога и стресс',
        ),
      ),
      GoRoute(
        path: RoutePaths.searchPattern,
        builder: (context, state) => SearchScreen(
          args: const SearchArgs(
            requestId: 'r1',
            topicSlug: 'anxiety-stress',
            format: SessionFormat.chat,
          ),
        ),
      ),
      GoRoute(
        path: RoutePaths.foundPattern,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-found')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
      analyticsProvider.overrideWithValue(analytics),
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
  late _RecordingAnalytics analytics;

  setUp(() {
    api = MockSqApi();
    socket = _FakeSqSocket();
    analytics = _RecordingAnalytics();
    addTearDown(socket.dispose);

    when(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).thenAnswer(
      (_) async => const MatchRequest(
        id: 'r1',
        status: RequestStatus.searching,
        isEmergency: false,
        clientCode: 4821,
      ),
    );
    when(() => api.requestById('r1')).thenAnswer(
      (_) async => const MatchRequest(
        id: 'r1',
        status: RequestStatus.searching,
        isEmergency: false,
        clientCode: 4821,
      ),
    );
    when(
      () => api.onlineCount(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        urgentOnly: any(named: 'urgentOnly'),
      ),
    ).thenAnswer((_) async => const OnlineCount(count: 3));
  });

  testWidgets('воронка порождает четыре события ТЗ §10 по порядку', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(api: api, socket: socket, analytics: analytics),
    );
    await tester.pumpAndSettle();

    // Тема выбрана — экран темы открыт именно с ней.
    expect(analytics.events.map((e) => e.name), ['topic_selected']);

    await tester.tap(find.byKey(const Key('sq-topic-format-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-format-chat')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-topic-continue')));
    // Не `pumpAndSettle`: на экране поиска тикают периодические таймеры, и
    // «успокоиться» дерево не может по построению.
    await tester.pump();
    await tester.pump();
    await tester.pump();

    socket.push('request.updated', {
      'id': 'r1',
      'status': 'MATCHED',
      'consultationId': 'c1',
      'matchedExpert': _expertJson(),
    });
    await tester.pump();
    await tester.pump();

    expect(analytics.events.map((e) => e.name), [
      'topic_selected',
      'format_selected',
      'request_created',
      'expert_matched',
    ]);

    final matched =
        analytics.events.last.properties['seconds_to_match'] as int;
    expect(matched, greaterThanOrEqualTo(0));
    expect(
      analytics.events[2].properties['is_emergency'],
      isFalse,
    );

    // Снимаем дерево: на экране поиска живут периодические таймеры.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('свойства событий не содержат ПД', (tester) async {
    await tester.pumpWidget(
      _wrap(api: api, socket: socket, analytics: analytics),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-topic-format-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-format-chat')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-topic-continue')));
    await tester.pump();
    await tester.pump();

    for (final event in analytics.events) {
      expect(
        event.properties.keys.any(
          (key) => const ['phone', 'name', 'display_name', 'text'].contains(key),
        ),
        isFalse,
      );
    }

    await tester.pumpWidget(const SizedBox());
  });
}
