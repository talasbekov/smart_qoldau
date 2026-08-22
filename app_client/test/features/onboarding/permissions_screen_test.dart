// Виджет-тесты PermissionsScreen: «Позже» не запрашивает разрешения и
// выставляет `askedPermissions = true`; «Разрешить» дёргает подменённый
// `PermissionService` по одному разу на микрофон, камеру и уведомления.
// `permission_handler` — платформенный плагин, недоступный в
// `flutter test` без подмены канала, поэтому вместо мока канала (см.
// предупреждение в `core/permission_service.dart`) подставляется фейковая
// реализация через `permissionServiceProvider` — тест проверяет реальное
// поведение экрана (какие разрешения и в каком порядке запрошены), а не
// поведение мока.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/core/permission_service.dart';
import 'package:app_client/features/onboarding/state/onboarding_flags.dart';
import 'package:app_client/features/onboarding/ui/permissions_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class _FakePermissionService implements PermissionService {
  final List<SqPermission> requested = [];

  @override
  Future<void> request(SqPermission permission) async {
    requested.add(permission);
  }
}

/// [PermissionService], у которого `request` всегда падает — имитирует
/// сбой самого запроса разрешения у платформы (не отказ пользователя,
/// который вообще не бросает исключение).
class _ThrowingPermissionService implements PermissionService {
  @override
  Future<void> request(SqPermission permission) {
    throw Exception('permission request failed');
  }
}

/// [OnboardingFlags], у которого `setAskedPermissions` зависает до тех
/// пор, пока тест сам не откроет [gate] — нужен, чтобы поймать состояние
/// экрана СЕРЕДИНЕ операции «Позже» (аналог `_DelayedOnboardingFlags` в
/// `slides_screen_test.dart`).
class _DelayedOnboardingFlags extends OnboardingFlags {
  _DelayedOnboardingFlags(super.prefs, this.gate);

  final Completer<void> gate;

  @override
  Future<void> setAskedPermissions(bool value) async {
    await gate.future;
    return super.setAskedPermissions(value);
  }
}

Future<SharedPreferences> _prefs() async {
  SharedPreferences.setMockInitialValues({});
  return SharedPreferences.getInstance();
}

Widget _wrap(
  Widget child,
  SharedPreferences prefs,
  PermissionService service, {
  OnboardingFlags? flags,
}) {
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      permissionServiceProvider.overrideWithValue(service),
      if (flags != null) onboardingFlagsProvider.overrideWithValue(flags),
    ],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
}

final _allowButtonKey = find.byKey(const Key('sq-permissions-allow-button'));
final _laterButtonKey = find.byKey(const Key('sq-permissions-later-button'));

void main() {
  testWidgets(
    '«Позже» не запрашивает разрешения, выставляет askedPermissions и вызывает onFinished',
    (tester) async {
      final prefs = await _prefs();
      final service = _FakePermissionService();
      var finished = false;

      await tester.pumpWidget(
        _wrap(
          PermissionsScreen(onFinished: () => finished = true),
          prefs,
          service,
        ),
      );

      expect(OnboardingFlags(prefs).askedPermissions, isFalse);

      final l10n = AppLocalizations.of(
        tester.element(find.byType(PermissionsScreen)),
      )!;
      await tester.tap(find.text(l10n.actionLater));
      await tester.pumpAndSettle();

      expect(service.requested, isEmpty);
      expect(OnboardingFlags(prefs).askedPermissions, isTrue);
      expect(finished, isTrue);
    },
  );

  testWidgets(
    '«Разрешить» запрашивает микрофон, камеру и уведомления по одному разу каждое',
    (tester) async {
      final prefs = await _prefs();
      final service = _FakePermissionService();
      var finished = false;

      await tester.pumpWidget(
        _wrap(
          PermissionsScreen(onFinished: () => finished = true),
          prefs,
          service,
        ),
      );

      final l10n = AppLocalizations.of(
        tester.element(find.byType(PermissionsScreen)),
      )!;
      await tester.tap(find.text(l10n.actionAllow));
      await tester.pumpAndSettle();

      expect(service.requested, [
        SqPermission.microphone,
        SqPermission.camera,
        SqPermission.notifications,
      ]);
      expect(OnboardingFlags(prefs).askedPermissions, isTrue);
      expect(finished, isTrue);
    },
  );

  testWidgets(
    'исключение при запросе разрешения показывает SnackBar и всё равно продолжает — БП-10 запрещает запирать онбординг из-за сбоя разрешений',
    (tester) async {
      final prefs = await _prefs();
      var finished = false;

      await tester.pumpWidget(
        _wrap(
          PermissionsScreen(onFinished: () => finished = true),
          prefs,
          _ThrowingPermissionService(),
        ),
      );

      final l10n = AppLocalizations.of(
        tester.element(find.byType(PermissionsScreen)),
      )!;
      await tester.tap(find.text(l10n.actionAllow));
      await tester.pumpAndSettle();

      // Ничего не должно долететь до тестовой зоны как необработанное —
      // экран сам ловит исключение и показывает SnackBar (см. `_allow`).
      expect(tester.takeException(), isNull);
      expect(
        find.widgetWithText(SnackBar, l10n.errorGeneric),
        findsOneWidget,
        reason:
            'сбой самого запроса — не отказ пользователя — должен быть виден',
      );

      // И всё равно продолжает: отказ/сбой разрешений не блокирует вход.
      expect(OnboardingFlags(prefs).askedPermissions, isTrue);
      expect(finished, isTrue);

      final allowButton = tester.widget<SqButton>(_allowButtonKey);
      final laterButton = tester.widget<SqButton>(_laterButtonKey);
      expect(
        allowButton.onPressed,
        isNotNull,
        reason:
            'без finally вокруг _allow() флаг _requesting остался бы true '
            'навсегда, и обе кнопки — заблокированными',
      );
      expect(laterButton.onPressed, isNotNull);
      expect(allowButton.loading, isFalse);
    },
  );

  testWidgets(
    '«Позже» крутит индикатор только на своей кнопке и блокирует обе на время операции',
    (tester) async {
      final prefs = await _prefs();
      final gate = Completer<void>();

      await tester.pumpWidget(
        _wrap(
          PermissionsScreen(onFinished: () {}),
          prefs,
          _FakePermissionService(),
          flags: _DelayedOnboardingFlags(prefs, gate),
        ),
      );

      final l10n = AppLocalizations.of(
        tester.element(find.byType(PermissionsScreen)),
      )!;
      await tester.tap(find.text(l10n.actionLater));
      await tester.pump();

      final allowButton = tester.widget<SqButton>(_allowButtonKey);
      final laterButton = tester.widget<SqButton>(_laterButtonKey);

      expect(
        allowButton.onPressed,
        isNull,
        reason: 'обе кнопки блокируются на время любой операции',
      );
      expect(laterButton.onPressed, isNull);
      expect(
        allowButton.loading,
        isFalse,
        reason: '«Позже» не должна крутить спиннер на кнопке "Разрешить"',
      );
      expect(laterButton.loading, isTrue);

      gate.complete();
      await tester.pumpAndSettle();

      expect(tester.widget<SqButton>(_allowButtonKey).onPressed, isNotNull);
      expect(tester.widget<SqButton>(_laterButtonKey).onPressed, isNotNull);
    },
  );
}
