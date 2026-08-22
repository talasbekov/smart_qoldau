// Виджет-тесты SlidesScreen: ровно три слайда, свайп меняет активную точку
// индикатора, «Пропустить» на первом слайде выставляет `seenSlides = true`
// и уводит дальше. Экран сам никуда не навигирует (см. `onFinished` —
// решение, куда вести пользователя, принимает вызывающая сторона, как и
// `SplashScreen.onRestored` в задаче 5), поэтому «уводит дальше» здесь
// проверяется через вызов колбэка.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/features/onboarding/state/onboarding_flags.dart';
import 'package:app_client/features/onboarding/ui/slides_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

Future<SharedPreferences> _prefs() async {
  SharedPreferences.setMockInitialValues({});
  return SharedPreferences.getInstance();
}

Widget _wrap(Widget child, SharedPreferences prefs) {
  return ProviderScope(
    overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
}

Color _dotColor(WidgetTester tester, int index) {
  final container = tester.widget<AnimatedContainer>(
    find.byKey(ValueKey('sq-onboarding-dot-$index')),
  );
  return (container.decoration! as BoxDecoration).color!;
}

void main() {
  testWidgets(
    'ровно три слайда: три точки индикатора, четвёртой нет, первая активна изначально',
    (tester) async {
      final prefs = await _prefs();
      await tester.pumpWidget(_wrap(SlidesScreen(onFinished: () {}), prefs));

      expect(find.byType(PageView), findsOneWidget);
      expect(find.byKey(const ValueKey('sq-onboarding-dot-0')), findsOneWidget);
      expect(find.byKey(const ValueKey('sq-onboarding-dot-1')), findsOneWidget);
      expect(find.byKey(const ValueKey('sq-onboarding-dot-2')), findsOneWidget);
      expect(find.byKey(const ValueKey('sq-onboarding-dot-3')), findsNothing);

      expect(_dotColor(tester, 0), SqColors.primary);
      expect(_dotColor(tester, 1), isNot(SqColors.primary));
      expect(_dotColor(tester, 2), isNot(SqColors.primary));
    },
  );

  testWidgets('свайп вперёд переключает активную точку индикатора на вторую', (
    tester,
  ) async {
    final prefs = await _prefs();
    await tester.pumpWidget(_wrap(SlidesScreen(onFinished: () {}), prefs));

    await tester.drag(find.byType(PageView), const Offset(-600, 0));
    await tester.pumpAndSettle();

    expect(_dotColor(tester, 1), SqColors.primary);
    expect(_dotColor(tester, 0), isNot(SqColors.primary));
  });

  testWidgets(
    '«Пропустить» на первом слайде выставляет seenSlides=true и вызывает onFinished',
    (tester) async {
      final prefs = await _prefs();
      var finished = false;
      await tester.pumpWidget(
        _wrap(SlidesScreen(onFinished: () => finished = true), prefs),
      );

      expect(OnboardingFlags(prefs).seenSlides, isFalse);

      final l10n = AppLocalizations.of(
        tester.element(find.byType(SlidesScreen)),
      )!;
      await tester.tap(find.text(l10n.slidesSkip));
      await tester.pumpAndSettle();

      expect(OnboardingFlags(prefs).seenSlides, isTrue);
      expect(finished, isTrue);
    },
  );

  testWidgets(
    'кнопка "Далее" доводит до последнего слайда, где превращается в "Начать" и тоже завершает онбординг',
    (tester) async {
      final prefs = await _prefs();
      var finished = false;
      await tester.pumpWidget(
        _wrap(SlidesScreen(onFinished: () => finished = true), prefs),
      );

      final l10n = AppLocalizations.of(
        tester.element(find.byType(SlidesScreen)),
      )!;

      await tester.tap(find.text(l10n.slidesNext));
      await tester.pumpAndSettle();
      expect(_dotColor(tester, 1), SqColors.primary);

      await tester.tap(find.text(l10n.slidesNext));
      await tester.pumpAndSettle();
      expect(_dotColor(tester, 2), SqColors.primary);
      expect(find.text(l10n.slidesStart), findsOneWidget);

      await tester.tap(find.text(l10n.slidesStart));
      await tester.pumpAndSettle();

      expect(OnboardingFlags(prefs).seenSlides, isTrue);
      expect(finished, isTrue);
    },
  );
}
