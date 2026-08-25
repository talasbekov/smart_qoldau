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

ClientConsultation _activeConsultation() => ClientConsultation(
  id: 'c-active',
  status: ConsultationStatus.active,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: DateTime(2026, 8, 22, 10),
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: ConsultationPaymentStatus.held,
  expert: const ExpertPublic(
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
    ratingCount: 12,
  ),
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
      GoRoute(
        path: RoutePaths.sessionPattern,
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-session:${state.pathParameters['id']}'),
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
  setUpAll(() {
    registerFallbackValue(SessionFormat.chat);
    registerFallbackValue(ConsultationStatus.active);
  });

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

  testWidgets(
    'ACTIVE_REQUEST_EXISTS с идущей консультацией предлагает перейти в неё',
    (tester) async {
      // Задача 17: раньше диалог был тупиком («у вас уже есть заявка» — и
      // всё). Теперь, если у клиента есть АКТИВНАЯ консультация, ему дают
      // в неё перейти; если её нет (заявка ещё ищет специалиста), кнопки
      // не будет — эндпоинта «моя активная заявка» бэкенд не даёт.
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
      when(
        () => api.consultations(
          status: ConsultationStatus.active,
          take: any(named: 'take'),
          skip: any(named: 'skip'),
        ),
      ).thenAnswer((_) async => [_activeConsultation()]);

      await tester.pumpWidget(_wrap(api));
      await tester.pump();

      await _chooseFormat(tester, 'Чат');
      await tester.tap(find.text('Продолжить'));
      await tester.pumpAndSettle();

      expect(find.text('У вас уже есть активная заявка'), findsOneWidget);

      await tester.tap(find.text('Перейти к консультации'));
      await tester.pumpAndSettle();

      expect(find.text('sq-stub-session:c-active'), findsOneWidget);
    },
  );

  testWidgets(
    'ACTIVE_REQUEST_EXISTS без активной консультации оставляет только пояснение',
    (tester) async {
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
      when(
        () => api.consultations(
          status: ConsultationStatus.active,
          take: any(named: 'take'),
          skip: any(named: 'skip'),
        ),
      ).thenAnswer((_) async => []);

      await tester.pumpWidget(_wrap(api));
      await tester.pump();

      await _chooseFormat(tester, 'Чат');
      await tester.tap(find.text('Продолжить'));
      await tester.pumpAndSettle();

      expect(find.text('У вас уже есть активная заявка'), findsOneWidget);
      expect(find.text('Перейти к консультации'), findsNothing);
    },
  );

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
