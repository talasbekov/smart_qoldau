// Виджет-тесты каталога (сверх минимума брифа — урок 1): список, пустое
// состояние со сбросом фильтров, фильтрация через шторку и переход в
// профиль специалиста.
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
import 'package:app_client/features/catalog/ui/catalog_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

ExpertPublic _expert(String id, String name) => ExpertPublic(
  id: id,
  displayName: name,
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  priceTiyn: 399000,
  languages: const ['ru'],
  formats: const [SessionFormat.chat],
  topicSlugs: const ['anxiety-stress'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.8,
  ratingCount: 20,
);

Future<Widget> _wrap(SqApi api) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();

  final router = GoRouter(
    initialLocation: RoutePaths.catalog,
    routes: [
      GoRoute(
        path: RoutePaths.catalog,
        builder: (context, state) => const CatalogScreen(),
        routes: [
          GoRoute(
            path: 'expert/:id',
            builder: (context, state) => Scaffold(
              body: Text('sq-stub-expert:${state.pathParameters['id']}'),
            ),
          ),
          GoRoute(
            path: 'favorites',
            builder: (context, state) =>
                const Scaffold(body: Text('sq-stub-favorites')),
          ),
        ],
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

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.chat));

  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(() => api.favorites()).thenAnswer((_) async => []);
    when(() => api.addFavorite(any())).thenAnswer((_) async {});
    when(() => api.removeFavorite(any())).thenAnswer((_) async {});
    when(() => api.topics(locale: any(named: 'locale'))).thenAnswer(
      (_) async => const [
        Topic(id: 't1', slug: 'anxiety-stress', name: 'Тревога и стресс'),
        Topic(id: 't2', slug: 'burnout', name: 'Выгорание'),
      ],
    );
    when(
      () => api.experts(
        topic: any(named: 'topic'),
        language: any(named: 'language'),
        format: any(named: 'format'),
        sort: any(named: 'sort'),
      ),
    ).thenAnswer((_) async => [_expert('e1', 'Динара С.')]);
  });

  testWidgets('показывает специалистов и уводит в профиль по тапу', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Динара С.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('sq-expert-card-e1')));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-expert:e1'), findsOneWidget);
  });

  testWidgets('пустая выдача предлагает сбросить фильтры и делает это', (
    tester,
  ) async {
    when(
      () => api.experts(
        topic: any(named: 'topic'),
        language: any(named: 'language'),
        format: any(named: 'format'),
        sort: any(named: 'sort'),
      ),
    ).thenAnswer((invocation) async {
      final topic = invocation.namedArguments[#topic];
      return topic == null ? [_expert('e1', 'Динара С.')] : <ExpertPublic>[];
    });

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-catalog-filters')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-filter-topic-burnout')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-filters-apply')));
    await tester.pumpAndSettle();

    expect(find.text('По этим фильтрам никого не нашлось'), findsOneWidget);

    await tester.tap(find.byKey(const Key('sq-catalog-reset-filters')));
    await tester.pumpAndSettle();

    expect(find.text('Динара С.'), findsOneWidget);
  });

  testWidgets('фильтр по формату уходит в запрос', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-catalog-filters')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-filter-format-video')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-filters-apply')));
    await tester.pumpAndSettle();

    verify(
      () => api.experts(
        topic: null,
        language: null,
        format: SessionFormat.video,
        sort: null,
      ),
    ).called(1);
  });

  testWidgets('звезда в карточке добавляет в избранное', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-expert-card-favorite-e1')));
    await tester.pump();

    verify(() => api.addFavorite('e1')).called(1);
  });

  testWidgets('кнопка избранного открывает свой экран', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-catalog-favorites')));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-favorites'), findsOneWidget);
  });

  testWidgets('сбой каталога даёт SqErrorView с рабочим «Повторить»', (
    tester,
  ) async {
    var calls = 0;
    when(
      () => api.experts(
        topic: any(named: 'topic'),
        language: any(named: 'language'),
        format: any(named: 'format'),
        sort: any(named: 'sort'),
      ),
    ).thenAnswer((_) async {
      calls++;
      if (calls == 1) {
        throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
      }
      return [_expert('e1', 'Динара С.')];
    });

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Нет соединения с сервером'), findsOneWidget);

    await tester.tap(find.text('Повторить'));
    await tester.pumpAndSettle();

    expect(find.text('Динара С.'), findsOneWidget);
  });
}
