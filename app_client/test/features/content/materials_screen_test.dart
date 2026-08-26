// Виджет-тесты вкладки «Материалы» (E13, задача 9): список, категории,
// замок на платном материале, стрик.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/content/ui/materials_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

ContentItem _article() => const ContentItem(
  id: 'c1',
  kind: ContentKind.article,
  access: ContentAccess.free,
  slug: 'anxiety-basics',
  category: 'anxiety',
  title: 'Как справиться с тревогой',
  summary: 'Кратко о главном',
  durationSec: 300,
);

ContentItem _lockedMeditation() => const ContentItem(
  id: 'c2',
  kind: ContentKind.meditation,
  access: ContentAccess.premium,
  slug: 'deep-sleep',
  category: 'sleep',
  title: 'Глубокий сон',
  summary: '20 минут',
  durationSec: 1200,
  locked: true,
);

const _streak = ContentStreak(
  currentDays: 6,
  longestDays: 12,
  completedCount: 34,
);

Widget _wrap(SqApi api) {
  final router = GoRouter(
    initialLocation: RoutePaths.materials,
    routes: [
      GoRoute(
        path: RoutePaths.materials,
        builder: (context, state) => const MaterialsScreen(),
      ),
      GoRoute(
        path: RoutePaths.premium,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-premium')),
      ),
      GoRoute(
        path: '/materials/:id',
        builder: (context, state) =>
            Scaffold(body: Text('sq-stub-item-${state.pathParameters['id']}')),
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

void main() {
  late MockSqApi api;

  setUpAll(() => registerFallbackValue(ContentKind.article));

  setUp(() {
    api = MockSqApi();
    when(
      () => api.content(
        kind: any(named: 'kind'),
        category: any(named: 'category'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => [_article(), _lockedMeditation()]);
    when(() => api.contentStreak()).thenAnswer((_) async => _streak);
  });

  testWidgets('показывает материалы и стрик', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Как справиться с тревогой'), findsOneWidget);
    expect(find.text('Глубокий сон'), findsOneWidget);
    // Стрик — обратная связь, а не награда: просто число дней подряд.
    expect(find.textContaining('6'), findsWidgets);
  });

  testWidgets('платный материал: замок и переход на Premium, а не плеер', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('sq-content-lock-c2')), findsOneWidget);

    await tester.tap(find.byKey(const Key('sq-content-item-c2')));
    await tester.pumpAndSettle();
    expect(find.text('sq-stub-premium'), findsOneWidget);
  });

  testWidgets('бесплатный материал открывается', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-content-item-c1')));
    await tester.pumpAndSettle();
    expect(find.text('sq-stub-item-c1'), findsOneWidget);
  });

  testWidgets('фильтр по виду перезапрашивает список', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-content-filter-ARTICLE')));
    await tester.pumpAndSettle();

    verify(
      () => api.content(
        kind: ContentKind.article,
        category: null,
        take: any(named: 'take'),
        skip: 0,
      ),
    ).called(1);
  });

  testWidgets('прокрутка до конца подгружает следующую страницу', (
    tester,
  ) async {
    // Библиотека постраничная: показать первую страницу и молча потерять
    // остальное — то же самое, что не показать материалы вовсе.
    final firstPage = List.generate(
      20,
      (i) => ContentItem(
        id: 'p$i',
        kind: ContentKind.article,
        access: ContentAccess.free,
        slug: 'article-$i',
        category: 'anxiety',
        title: 'Материал $i',
        summary: 'Кратко',
      ),
    );
    when(
      () => api.content(
        kind: any(named: 'kind'),
        category: any(named: 'category'),
        take: any(named: 'take'),
        skip: 0,
      ),
    ).thenAnswer((_) async => firstPage);
    when(
      () => api.content(
        kind: any(named: 'kind'),
        category: any(named: 'category'),
        take: any(named: 'take'),
        skip: 20,
      ),
    ).thenAnswer((_) async => [_article()]);

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.drag(find.byType(Scrollable).last, const Offset(0, -3000));
    await tester.pumpAndSettle();

    verify(
      () => api.content(
        kind: any(named: 'kind'),
        category: any(named: 'category'),
        take: any(named: 'take'),
        skip: 20,
      ),
    ).called(1);
  });

  testWidgets('пустой список объясняется словами, а не пустотой', (
    tester,
  ) async {
    when(
      () => api.content(
        kind: any(named: 'kind'),
        category: any(named: 'category'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => []);

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('sq-content-empty')), findsOneWidget);
  });

  testWidgets('на экране 411 dp ничего не переполняется', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
