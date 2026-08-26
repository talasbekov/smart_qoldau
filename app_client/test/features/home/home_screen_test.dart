// Виджет-тесты HomeScreen (Step 2 брифа задачи 7): 12 тем из мока API, тап
// по теме ведёт на `/topic?slug=`, баннер активной консультации виден/не
// виден в зависимости от данных, ошибка API даёт `SqErrorView` с рабочим
// «Повторить». Плюс сверх минимума брифа (см. урок задачи 6 — недостающий
// тест на нетривиальную логику экрана прячет реальные баги): пустой (но не
// ошибочный) ответ `topics` — тоже `SqErrorView` (явное требование брифа,
// disambiguation №8), кнопка «Мне нужна помощь сейчас» ведёт на `/emergency`,
// значок уведомлений присутствует.
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

ExpertPublic _fakeExpert() => const ExpertPublic(
  id: 'e1',
  displayName: 'Айгуль Т.',
  city: 'Алматы',
  experience: ExperienceLevel.oneToThree,
  priceTiyn: 500000,
  languages: ['ru'],
  formats: [SessionFormat.chat],
  topicSlugs: ['anxiety-stress'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.8,
  ratingCount: 10,
);

ClientConsultation _fakeActiveConsultation() => ClientConsultation(
  id: 'c1',
  status: ConsultationStatus.active,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: DateTime(2026, 1, 1),
  priceTiyn: 500000,
  plannedDurationMin: 50,
  paymentStatus: ConsultationPaymentStatus.held,
  expert: _fakeExpert(),
);

/// Ровно 12 тем (Р-14 из брифа) — первая специально с slug'ом
/// `anxiety-stress`, который называет Step 2 брифа для теста тапа.
List<Topic> _fakeTopics() => [
  const Topic(id: 't0', slug: 'anxiety-stress', name: 'Тревога и стресс'),
  ...List.generate(
    11,
    (i) =>
        Topic(id: 't${i + 1}', slug: 'topic-${i + 1}', name: 'Тема ${i + 1}'),
  ),
];

Future<Widget> _wrap(SqApi api) async {
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
        path: RoutePaths.emergency,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-emergency')),
      ),
      GoRoute(
        path: RoutePaths.topic,
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-topic:${state.uri.queryParameters['slug']}'),
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

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

void main() {
  setUpAll(() {
    registerFallbackValue(ConsultationStatus.active);
  });

  void stubNoActiveConsultation(MockSqApi api) {
    when(() => api.consultations(status: any(named: 'status')))
        .thenAnswer((_) async => <ClientConsultation>[]);
  }

  testWidgets('12 тем отрисованы из мока API', (tester) async {
    final api = MockSqApi();
    when(() => api.topics(locale: any(named: 'locale')))
        .thenAnswer((_) async => _fakeTopics());
    stubNoActiveConsultation(api);

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    for (final topic in _fakeTopics()) {
      expect(
        find.byKey(Key('sq-topic-${topic.slug}')),
        findsOneWidget,
        reason: 'тема ${topic.slug} должна быть отрисована',
      );
    }

    // Ревью раунда 1 задачи 7: сверка с прототипом `07-home.png` была
    // сделана только ради одного поля (счётчик онлайна) — эти два элемента
    // из того же прототипа изначально были пропущены.
    final l10n = AppLocalizations.of(tester.element(find.byType(HomeScreen)))!;
    expect(find.text(l10n.homeTopicsSubtitle), findsOneWidget);

    // Панель ниже сетки из 12 тем не помещается в высоту тестового
    // вьюпорта — `ListView` строит только видимые (плюс небольшой запас)
    // элементы своих слайверов, поэтому её нужно сначала докрутить, а не
    // просто искать в дереве.
    await tester.scrollUntilVisible(
      find.byKey(const Key('sq-home-emergency-notice')),
      300,
      // `.first`: и внешний `ListView` `_HomeContent`, и вложенный (хоть и
      // нескролящийся сам по себе — `NeverScrollableScrollPhysics`)
      // `GridView` темы оборачиваются в собственный `Scrollable`, поэтому
      // `find.byType(Scrollable)` без уточнения находит два совпадения.
      // Внешний идёт первым в порядке обхода дерева.
      scrollable: find.byType(Scrollable).first,
    );
    expect(
      find.byKey(const Key('sq-home-emergency-notice')),
      findsOneWidget,
      reason:
          'информационная панель "Экстренная ситуация" — требование ТЗ §4.3, '
          'не украшение прототипа',
    );
  });

  testWidgets(
    'тап по теме anxiety-stress переводит на /topic?slug=anxiety-stress',
    (tester) async {
      final api = MockSqApi();
      when(() => api.topics(locale: any(named: 'locale')))
          .thenAnswer((_) async => _fakeTopics());
      stubNoActiveConsultation(api);

      await tester.pumpWidget(await _wrap(api));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('sq-topic-anxiety-stress')));
      await tester.pumpAndSettle();

      expect(find.text('sq-stub-topic:anxiety-stress'), findsOneWidget);
    },
  );

  testWidgets('при наличии активной консультации виден баннер', (tester) async {
    final api = MockSqApi();
    when(() => api.topics(locale: any(named: 'locale')))
        .thenAnswer((_) async => _fakeTopics());
    when(() => api.consultations(status: any(named: 'status')))
        .thenAnswer((_) async => [_fakeActiveConsultation()]);

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('sq-active-consultation-banner')),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const Key('sq-active-consultation-banner')));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-session:c1'), findsOneWidget);
  });

  testWidgets('без активной консультации баннер не отрисован', (tester) async {
    final api = MockSqApi();
    when(() => api.topics(locale: any(named: 'locale')))
        .thenAnswer((_) async => _fakeTopics());
    stubNoActiveConsultation(api);

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('sq-active-consultation-banner')),
      findsNothing,
    );
  });

  testWidgets(
    'ошибка API при загрузке тем даёт SqErrorView, "Повторить" повторяет запрос',
    (tester) async {
      final api = MockSqApi();
      var attempt = 0;
      when(() => api.topics(locale: any(named: 'locale')))
          .thenAnswer((_) async {
            attempt++;
            if (attempt == 1) {
              throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
            }
            return _fakeTopics();
          });
      stubNoActiveConsultation(api);

      await tester.pumpWidget(await _wrap(api));
      await tester.pumpAndSettle();

      expect(find.byType(SqErrorView), findsOneWidget);
      final l10n = AppLocalizations.of(
        tester.element(find.byType(HomeScreen)),
      )!;
      expect(find.text(l10n.errorNetwork), findsOneWidget);
      // Кнопка «Повторить» обязана быть локализована через `l10n.actionRetry`
      // (ревью раунда 1 задачи 7: `SqErrorView.retryLabel` больше не зашит
      // строкой внутри пакета `shared`) — искать её по русскому литералу
      // напрямую здесь неверно: тестовое окружение без явного `locale:`
      // резолвится в первый поддерживаемый язык (`kk`, см.
      // `AppLocalizations.supportedLocales`), а не в русский.
      expect(find.text(l10n.actionRetry), findsOneWidget);

      await tester.tap(find.text(l10n.actionRetry));
      await tester.pumpAndSettle();

      expect(find.byType(SqErrorView), findsNothing);
      expect(find.byKey(const Key('sq-topic-anxiety-stress')), findsOneWidget);
      expect(attempt, 2);
    },
  );

  testWidgets(
    'пустой (но не ошибочный) ответ topics — тоже SqErrorView, а не пустой экран',
    (tester) async {
      final api = MockSqApi();
      when(() => api.topics(locale: any(named: 'locale')))
          .thenAnswer((_) async => <Topic>[]);
      stubNoActiveConsultation(api);

      await tester.pumpWidget(await _wrap(api));
      await tester.pumpAndSettle();

      expect(find.byType(SqErrorView), findsOneWidget);
      final l10n = AppLocalizations.of(
        tester.element(find.byType(HomeScreen)),
      )!;
      expect(find.text(l10n.actionRetry), findsOneWidget);
    },
  );

  testWidgets('кнопка "Мне нужна помощь сейчас" ведёт на /emergency', (
    tester,
  ) async {
    final api = MockSqApi();
    when(() => api.topics(locale: any(named: 'locale')))
        .thenAnswer((_) async => _fakeTopics());
    stubNoActiveConsultation(api);

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-home-emergency-button')));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-emergency'), findsOneWidget);
  });

  testWidgets('значок уведомлений присутствует в аппбаре главной', (
    tester,
  ) async {
    final api = MockSqApi();
    when(() => api.topics(locale: any(named: 'locale')))
        .thenAnswer((_) async => _fakeTopics());
    stubNoActiveConsultation(api);

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('sq-home-notifications-button')),
      findsOneWidget,
    );
  });
}
