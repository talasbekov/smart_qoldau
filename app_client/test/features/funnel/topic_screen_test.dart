// Виджет-тесты экрана темы (сверх минимума Step 2 брифа — урок 1 плана
// эпика: экран с нетривиальной логикой покрывается, даже если бриф молчит):
// выбор формата, создание заявки, переход на экран поиска и обе ошибочные
// ветки создания (ACTIVE_REQUEST_EXISTS и сбой сети).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/funnel/ui/topic_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

MatchRequest _created() => const MatchRequest(
  id: 'r1',
  status: RequestStatus.searching,
  isEmergency: false,
  clientCode: 4821,
);

Widget _wrap(SqApi api) {
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
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-search:${state.pathParameters['requestId']}'),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [sqApiProvider.overrideWithValue(api)],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

Future<void> _chooseFormat(WidgetTester tester, String label) async {
  await tester.tap(find.text('Формат общения'));
  await tester.pumpAndSettle();
  await tester.tap(find.text(label));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.chat));

  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).thenAnswer((_) async => _created());
  });

  testWidgets('показывает название выбранной темы', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    expect(find.text('Тревога и стресс'), findsOneWidget);
    expect(find.text('Расскажите, что вас тревожит'), findsOneWidget);
  });

  testWidgets('пока формат не выбран, «Продолжить» не создаёт заявку', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await tester.tap(find.text('Продолжить'));
    await tester.pumpAndSettle();

    verifyNever(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    );
    expect(find.text('Продолжить'), findsOneWidget);
  });

  testWidgets('выбранный формат и тема уходят в заявку, экран — на поиск', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await _chooseFormat(tester, 'Видео');
    await tester.tap(find.text('Продолжить'));
    await tester.pumpAndSettle();

    verify(
      () => api.createRequest(
        topicSlug: 'anxiety-stress',
        format: SessionFormat.video,
        isEmergency: false,
        expertId: null,
      ),
    ).called(1);
    expect(find.text('sq-stub-search:r1'), findsOneWidget);
  });

  testWidgets('ACTIVE_REQUEST_EXISTS показывает диалог, а не общую ошибку', (
    tester,
  ) async {
    when(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).thenThrow(
      const ApiException(
        ApiErrorCode.activeRequestExists,
        'active request exists',
        409,
      ),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await _chooseFormat(tester, 'Чат');
    await tester.tap(find.text('Продолжить'));
    await tester.pumpAndSettle();

    expect(find.text('У вас уже есть активная заявка'), findsOneWidget);
  });

  testWidgets('сбой сети показывает ошибку и не блокирует кнопку навсегда', (
    tester,
  ) async {
    when(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).thenThrow(const ApiException(ApiErrorCode.network, 'нет сети', 0));

    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await _chooseFormat(tester, 'Чат');
    await tester.tap(find.text('Продолжить'));
    await tester.pumpAndSettle();

    expect(find.text('Нет соединения с сервером'), findsOneWidget);
    expect(find.text('Продолжить'), findsOneWidget);

    // Кнопка снова рабочая: повторный тап действительно уходит в сеть.
    await tester.tap(find.text('Продолжить'));
    await tester.pumpAndSettle();
    verify(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).called(2);
  });
}
