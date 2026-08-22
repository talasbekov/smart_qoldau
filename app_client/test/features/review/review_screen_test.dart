// Виджет-тесты экрана оценки (Step 1–2 брифа задачи 15): звёзды, оба поля,
// «Пропустить», REVIEW_EXISTS и повторная запись к тому же специалисту.
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
import 'package:app_client/features/review/ui/review_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

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

ClientConsultation _consultation() => ClientConsultation(
  id: 'c1',
  status: ConsultationStatus.completed,
  outcome: ConsultationOutcome.completed,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: DateTime(2026, 8, 22, 10),
  endedAt: DateTime(2026, 8, 22, 10, 50),
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: ConsultationPaymentStatus.captured,
  expert: _expert(),
);

ReviewCreated _created() => ReviewCreated(
  id: 'rev-1',
  consultationId: 'c1',
  rating: 5,
  createdAt: DateTime(2026, 8, 22, 11),
);

Future<Widget> _wrap(SqApi api) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();

  final router = GoRouter(
    initialLocation: RoutePaths.review('c1'),
    routes: [
      GoRoute(
        path: RoutePaths.reviewPattern,
        builder: (context, state) =>
            ReviewScreen(consultationId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-home')),
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
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

/// Тап по [index]-й звезде (нумерация с 1).
Future<void> _tapStar(WidgetTester tester, int index) async {
  await tester.tap(find.byKey(Key('sq-review-star-$index')));
  await tester.pump();
}

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.chat));

  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(
      () => api.consultationById('c1'),
    ).thenAnswer((_) async => _consultation());
    when(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    ).thenAnswer((_) async => _created());
    when(() => api.topics(locale: any(named: 'locale'))).thenAnswer(
      (_) async => const [
        Topic(id: 't1', slug: 'anxiety-stress', name: 'Тревога и стресс'),
        Topic(id: 't2', slug: 'burnout', name: 'Выгорание'),
      ],
    );
  });

  testWidgets('показывает специалиста и вопрос об оценке', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Динара С.'), findsOneWidget);
    expect(find.text('Как прошла консультация?'), findsOneWidget);
    expect(find.text('Завершить'), findsOneWidget);
  });

  testWidgets('без звёзд «Завершить» ничего не отправляет', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Завершить'));
    await tester.pumpAndSettle();

    verifyNever(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    );
  });

  testWidgets('оценка и оба текста уходят в API, экран уводит на главную', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await _tapStar(tester, 4);
    expect(find.text('Хорошо'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('sq-review-public')),
      'помогло',
    );
    await tester.enterText(
      find.byKey(const Key('sq-review-private')),
      'всё отлично',
    );
    await tester.tap(find.text('Завершить'));
    await tester.pumpAndSettle();

    verify(
      () => api.createReview(
        'c1',
        rating: 4,
        publicText: 'помогло',
        privateText: 'всё отлично',
      ),
    ).called(1);
    expect(find.text('sq-stub-home'), findsOneWidget);
  });

  testWidgets('«Пропустить» ставит флаг и уводит на главную', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Пропустить'));
    await tester.pumpAndSettle();

    verifyNever(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    );
    expect(find.text('sq-stub-home'), findsOneWidget);
  });

  testWidgets('REVIEW_EXISTS показывает свой экран без повторной отправки', (
    tester,
  ) async {
    when(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    ).thenThrow(
      const ApiException(ApiErrorCode.reviewExists, 'already', 409),
    );

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await _tapStar(tester, 5);
    await tester.tap(find.text('Завершить'));
    await tester.pumpAndSettle();

    expect(find.text('Вы уже оценили эту консультацию'), findsOneWidget);
    expect(find.text('Готово'), findsOneWidget);
  });

  testWidgets('сбой сети показывает ошибку и оставляет кнопку рабочей', (
    tester,
  ) async {
    when(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
      ),
    ).thenThrow(const ApiException(ApiErrorCode.network, 'нет сети', 0));

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await _tapStar(tester, 3);
    await tester.tap(find.text('Завершить'));
    await tester.pumpAndSettle();

    expect(find.text('Нет соединения с сервером'), findsOneWidget);
    expect(find.text('Завершить'), findsOneWidget);
  });

  testWidgets(
    '«Продолжить с тем же психологом» спрашивает тему и создаёт адресную '
    'заявку в формате прошедшей консультации',
    (tester) async {
      // Темы консультации в `ConsultationClientDto` нет (проверено по DTO
      // бэкенда), поэтому её выбирает клиент, а формат берётся из самой
      // консультации — он там есть.
      when(
        () => api.createRequest(
          topicSlug: any(named: 'topicSlug'),
          format: any(named: 'format'),
          isEmergency: any(named: 'isEmergency'),
          expertId: any(named: 'expertId'),
        ),
      ).thenAnswer(
        (_) async => const MatchRequest(
          id: 'r-directed',
          status: RequestStatus.searching,
          isEmergency: false,
          clientCode: 1234,
        ),
      );

      await tester.pumpWidget(await _wrap(api));
      await tester.pumpAndSettle();

      // Кнопка ниже сгиба — реальный пользователь до неё доскроллит.
      await tester.ensureVisible(find.text('Продолжить с тем же психологом'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Продолжить с тем же психологом'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Выгорание'));
      await tester.pumpAndSettle();

      verify(
        () => api.createRequest(
          topicSlug: 'burnout',
          format: SessionFormat.chat,
          isEmergency: false,
          expertId: 'e1',
        ),
      ).called(1);
      expect(find.text('sq-stub-search:r-directed'), findsOneWidget);
    },
  );

  testWidgets('EXPERT_UNAVAILABLE на повторной заявке показывает причину', (
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
      const ApiException(ApiErrorCode.expertUnavailable, 'busy', 409),
    );

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Продолжить с тем же психологом'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Продолжить с тем же психологом'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Тревога и стресс'));
    await tester.pumpAndSettle();

    expect(find.text('Эксперт сейчас недоступен'), findsOneWidget);
  });
}
