// Виджет-тесты VerificationStatusScreen (E7 задача 6): текст для каждого
// verificationStatus, REJECTED фото/about показывает moderationComment и
// кнопку «Загрузить заново», и — самое главное — страховочный опрос
// `me()` каждые 30 с ОСТАНАВЛИВАЕТСЯ, как только приходит VERIFIED (нет
// дальнейших вызовов). Проверяется виртуальным временем `tester.pump`
// (см. `search_controller_test.dart`/`search_screen_test.dart` в
// `app_client` — урок 3 плана эпика E6: гонку/периодичность нельзя
// проверить без управления временем, реальным ожиданием — тем более).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/core/route_paths.dart';
import 'package:app_expert/features/verification/ui/verification_status_screen.dart';
import 'package:app_expert/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

ExpertMe _me({
  required VerificationStatus verificationStatus,
  ProfileFieldStatus photoStatus = ProfileFieldStatus.none,
  ProfileFieldStatus aboutStatus = ProfileFieldStatus.none,
  String? moderationComment,
}) => ExpertMe(
  id: 'e1',
  displayName: 'Айгуль Т.',
  city: 'Алматы',
  experience: ExperienceLevel.oneToThree,
  education: 'КазНУ',
  priceTiyn: 500000,
  languages: const ['ru'],
  formats: const [SessionFormat.chat],
  topicSlugs: const ['anxiety-stress'],
  verificationStatus: verificationStatus,
  workStatus: WorkStatus.accepting,
  isBlocked: false,
  acceptsUrgent: false,
  photoStatus: photoStatus,
  aboutStatus: aboutStatus,
  moderationComment: moderationComment,
);

Widget _wrap(SqApi api) {
  final router = GoRouter(
    initialLocation: RoutePaths.verificationStatus,
    routes: [
      GoRoute(
        path: RoutePaths.verificationStatus,
        builder: (context, state) => const VerificationStatusScreen(),
      ),
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-home')),
      ),
      GoRoute(
        path: RoutePaths.verificationPhoto,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-photo')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [sqApiProvider.overrideWithValue(api)],
    child: MaterialApp.router(
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: router,
    ),
  );
}

/// Снимает дерево до конца теста: пока экран жив, живёт его `Timer.periodic`
/// опроса, а `flutter_test` считает незакрытый таймер утечкой ещё до
/// tearDown.
Future<void> _teardownTree(WidgetTester tester) =>
    tester.pumpWidget(const SizedBox());

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
  });

  testWidgets('DRAFT: показывает "анкета не отправлена"', (tester) async {
    when(() => api.me())
        .thenAnswer((_) async => _me(verificationStatus: VerificationStatus.draft));

    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    expect(find.text('Анкета не отправлена'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets('PENDING: показывает статус "на проверке" с SLA 24ч', (tester) async {
    when(() => api.me())
        .thenAnswer((_) async => _me(verificationStatus: VerificationStatus.pending));

    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    expect(find.textContaining('на проверке'), findsOneWidget);
    expect(find.textContaining('24'), findsOneWidget);

    await _teardownTree(tester);
  });

  testWidgets('VERIFIED сразу: уводит на главный экран без опроса', (tester) async {
    when(() => api.me())
        .thenAnswer((_) async => _me(verificationStatus: VerificationStatus.verified));

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-home'), findsOneWidget);

    clearInteractions(api);
    await tester.pump(const Duration(seconds: 60));
    verifyNever(() => api.me());
  });

  testWidgets('REJECTED фото: показывает moderationComment и кнопку «Загрузить заново»', (
    tester,
  ) async {
    when(() => api.me()).thenAnswer(
      (_) async => _me(
        verificationStatus: VerificationStatus.pending,
        photoStatus: ProfileFieldStatus.rejected,
        moderationComment: 'Плохое качество фото',
      ),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    expect(find.text('Плохое качество фото'), findsOneWidget);
    expect(find.text('Загрузить заново'), findsOneWidget);

    await tester.tap(find.text('Загрузить заново'));
    await tester.pumpAndSettle();
    expect(find.text('sq-stub-photo'), findsOneWidget);
  });

  testWidgets(
    'REJECTED только about (фото в порядке): показывает moderationComment, БЕЗ кнопки '
    '«Загрузить заново» — редактировать about пока негде, а фото трогать не нужно',
    (tester) async {
      when(() => api.me()).thenAnswer(
        (_) async => _me(
          verificationStatus: VerificationStatus.pending,
          aboutStatus: ProfileFieldStatus.rejected,
          moderationComment: 'Слишком короткое описание',
        ),
      );

      await tester.pumpWidget(_wrap(api));
      await tester.pump();

      expect(find.text('Слишком короткое описание'), findsOneWidget);
      expect(find.text('Загрузить заново'), findsNothing);

      await _teardownTree(tester);
    },
  );

  testWidgets(
    'REJECTED и фото, и about: кнопка «Загрузить заново» есть (фото — единственное реально '
    'исправимое действие)',
    (tester) async {
      when(() => api.me()).thenAnswer(
        (_) async => _me(
          verificationStatus: VerificationStatus.pending,
          photoStatus: ProfileFieldStatus.rejected,
          aboutStatus: ProfileFieldStatus.rejected,
          moderationComment: 'Фото и описание не приняты',
        ),
      );

      await tester.pumpWidget(_wrap(api));
      await tester.pump();

      expect(find.text('Фото и описание не приняты'), findsOneWidget);
      expect(find.text('Загрузить заново'), findsOneWidget);

      await tester.tap(find.text('Загрузить заново'));
      await tester.pumpAndSettle();
      expect(find.text('sq-stub-photo'), findsOneWidget);
    },
  );

  testWidgets('опрос обновляет статус раз в 30 секунд, не раньше', (tester) async {
    var calls = 0;
    when(() => api.me()).thenAnswer((_) async {
      calls++;
      return _me(
        verificationStatus: calls == 1
            ? VerificationStatus.pending
            : VerificationStatus.pending,
      );
    });

    await tester.pumpWidget(_wrap(api));
    await tester.pump();
    expect(calls, 1);

    await tester.pump(const Duration(seconds: 29));
    expect(calls, 1);

    await tester.pump(const Duration(seconds: 1));
    expect(calls, 2);

    await _teardownTree(tester);
  });

  testWidgets('опрос ОСТАНАВЛИВАЕТСЯ навсегда, как только приходит VERIFIED', (
    tester,
  ) async {
    var calls = 0;
    when(() => api.me()).thenAnswer((_) async {
      calls++;
      return _me(
        verificationStatus:
            calls < 3 ? VerificationStatus.pending : VerificationStatus.verified,
      );
    });

    await tester.pumpWidget(_wrap(api));
    await tester.pump();
    expect(calls, 1, reason: 'первый me() при открытии экрана');

    await tester.pump(const Duration(seconds: 30));
    expect(calls, 2, reason: 'первый страховочный опрос — всё ещё PENDING');

    await tester.pump(const Duration(seconds: 30));
    expect(calls, 3, reason: 'второй опрос — приходит VERIFIED, экран уезжает');
    await tester.pumpAndSettle();
    expect(find.text('sq-stub-home'), findsOneWidget);

    // Дальше время идёт, но новых вызовов быть не должно — таймер должен
    // быть отменён, а не просто "экран больше не показывает результат".
    await tester.pump(const Duration(seconds: 90));
    expect(calls, 3, reason: 'опрос не должен продолжаться после VERIFIED');
  });
}
