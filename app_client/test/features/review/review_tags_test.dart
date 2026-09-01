// Теги оценки (E2a, задача 7): набор зависит от числа звёзд, при смене
// оценки выбранные снимаются — теги четвёрки бессмысленны при единице.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
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

Future<void> _tapStar(WidgetTester tester, int index) async {
  await tester.tap(find.byKey(Key('sq-review-star-$index')));
  await tester.pump();
}

Future<void> _tapTag(WidgetTester tester, String code) async {
  await tester.tap(find.byKey(Key('sq-review-tag-$code')));
  await tester.pump();
}

/// Кнопка отправки лежит внизу ленивого списка — сначала доскроллить.
Future<void> _submit(WidgetTester tester) async {
  await tester.scrollUntilVisible(
    find.byKey(const Key('sq-review-submit')),
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.tap(find.byKey(const Key('sq-review-submit')));
  await tester.pumpAndSettle();
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(() => api.consultationById('c1'))
        .thenAnswer((_) async => _consultation());
    when(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
        tags: any(named: 'tags'),
      ),
    ).thenAnswer(
      (_) async => ReviewCreated(
        id: 'rev-1',
        consultationId: 'c1',
        rating: 5,
        createdAt: DateTime(2026, 8, 22, 11),
      ),
    );
  });

  testWidgets('до выбора оценки тегов нет', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('sq-review-tag-attentive')), findsNothing);
  });

  testWidgets('пятёрка показывает свой набор, двойка — свой', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await _tapStar(tester, 5);
    expect(find.text('Внимательный'), findsOneWidget);
    expect(find.text('Помог разобраться'), findsOneWidget);
    expect(find.text('Превзошёл ожидания'), findsOneWidget);

    await _tapStar(tester, 2);
    expect(find.text('Мало пользы'), findsOneWidget);
    expect(find.text('Превзошёл ожидания'), findsNothing);
  });

  testWidgets('смена оценки снимает ранее выбранные теги', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await _tapStar(tester, 5);
    await _tapTag(tester, 'attentive');
    await _tapStar(tester, 4);
    // Тег с тем же кодом есть и в наборе четвёрки, но выбор сброшен.
    await _submit(tester);

    final captured = verify(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
        tags: captureAny(named: 'tags'),
      ),
    ).captured.single;
    expect(captured, isNull);
  });

  testWidgets('выбирается не больше трёх тегов, повторный тап снимает', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await _tapStar(tester, 5);
    await _tapTag(tester, 'attentive');
    await _tapTag(tester, 'helped_figure_out');
    await _tapTag(tester, 'attentive'); // снимает
    await _tapTag(tester, 'exceeded_expectations');

    await _submit(tester);

    final captured = verify(
      () => api.createReview(
        any(),
        rating: any(named: 'rating'),
        publicText: any(named: 'publicText'),
        privateText: any(named: 'privateText'),
        tags: captureAny(named: 'tags'),
      ),
    ).captured.single;
    // Отправляются коды, а не подписи.
    expect(captured, ['helped_figure_out', 'exceeded_expectations']);
  });
}
