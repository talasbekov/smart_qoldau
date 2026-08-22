// Виджет-тесты SlidesScreen: ровно три слайда, свайп меняет активную точку
// индикатора, «Пропустить» на первом слайде выставляет `seenSlides = true`
// и уводит дальше. Экран сам никуда не навигирует (см. `onFinished` —
// решение, куда вести пользователя, принимает вызывающая сторона, как и
// `SplashScreen.onRestored` в задаче 5), поэтому «уводит дальше» здесь
// проверяется через вызов колбэка.
import 'dart:async';

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

/// [OnboardingFlags], у которого `setSeenSlides` зависает до тех пор, пока
/// тест сам не откроет [gate] — иначе запись в `SharedPreferences`
/// (реальная, пусть и мок-бэкенд) успевает завершиться прямо внутри
/// `await tester.tap(...)`, и повторный тап оказывается уже НЕ повторным
/// вызовом во время ожидания, а отдельным независимым действием после
/// того, как первое успело полностью отработать — то есть гонку, которую
/// должен ловить guard, было бы просто нечем проверить.
class _DelayedOnboardingFlags extends OnboardingFlags {
  _DelayedOnboardingFlags(super.prefs, this.gate);

  final Completer<void> gate;

  @override
  Future<void> setSeenSlides(bool value) async {
    await gate.future;
    return super.setSeenSlides(value);
  }
}

/// [OnboardingFlags], у которого `setSeenSlides` всегда падает — имитирует
/// сбой записи в `SharedPreferences` (например, инвалидацию хранилища).
class _ThrowingOnboardingFlags extends OnboardingFlags {
  _ThrowingOnboardingFlags(super.prefs);

  @override
  Future<void> setSeenSlides(bool value) {
    throw Exception('sq.onboarding.slides write failed');
  }
}

Widget _wrap(Widget child, SharedPreferences prefs, {OnboardingFlags? flags}) {
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      if (flags != null) onboardingFlagsProvider.overrideWithValue(flags),
    ],
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
    'повторный тап по "Пропустить" во время ожидания записи флага не завершает онбординг дважды',
    (tester) async {
      final prefs = await _prefs();
      final gate = Completer<void>();
      var finishedCount = 0;

      await tester.pumpWidget(
        _wrap(
          SlidesScreen(onFinished: () => finishedCount++),
          prefs,
          flags: _DelayedOnboardingFlags(prefs, gate),
        ),
      );

      final l10n = AppLocalizations.of(
        tester.element(find.byType(SlidesScreen)),
      )!;
      final skip = find.text(l10n.slidesSkip);

      // Специально без `pump()` между тапами: экран ещё не перестроился, у
      // кнопки в дереве всё ещё старый (незаблокированный) `onPressed` —
      // именно поэтому вторую попытку обязан отсечь guard внутри самого
      // `_guardedFinish()`, а не только `onPressed: null` после рендера.
      await tester.tap(skip);
      await tester.tap(skip, warnIfMissed: false);
      await tester.pump();

      gate.complete();
      await tester.pumpAndSettle();

      expect(finishedCount, 1);
    },
  );

  testWidgets(
    'исключение при записи флага сбрасывает _finishing — "Пропустить" не остаётся заблокирована навсегда',
    (tester) async {
      final prefs = await _prefs();
      await tester.pumpWidget(
        _wrap(
          SlidesScreen(onFinished: () {}),
          prefs,
          flags: _ThrowingOnboardingFlags(prefs),
        ),
      );

      final l10n = AppLocalizations.of(
        tester.element(find.byType(SlidesScreen)),
      )!;
      await tester.tap(find.text(l10n.slidesSkip));
      await tester.pumpAndSettle();

      // Экран сам гасит исключение (см. комментарий у `_guardedFinish`) —
      // ничего не должно долететь до тестовой зоны как необработанное.
      expect(tester.takeException(), isNull);

      final skipButton = tester.widget<TextButton>(find.byType(TextButton));
      expect(
        skipButton.onPressed,
        isNotNull,
        reason:
            'без finally вокруг _finish() флаг _finishing остался бы '
            'true навсегда, и кнопка "Пропустить" — заблокированной',
      );
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
