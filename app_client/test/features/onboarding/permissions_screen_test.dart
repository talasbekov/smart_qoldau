// Виджет-тесты PermissionsScreen: «Позже» не запрашивает разрешения и
// выставляет `askedPermissions = true`; «Разрешить» дёргает подменённый
// `PermissionService` по одному разу на микрофон, камеру и уведомления.
// `permission_handler` — платформенный плагин, недоступный в
// `flutter test` без подмены канала, поэтому вместо мока канала (см.
// предупреждение в `core/permission_service.dart`) подставляется фейковая
// реализация через `permissionServiceProvider` — тест проверяет реальное
// поведение экрана (какие разрешения и в каком порядке запрошены), а не
// поведение мока.
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
/// сбой самого запроса разрешения у платформы.
class _ThrowingPermissionService implements PermissionService {
  @override
  Future<void> request(SqPermission permission) {
    throw Exception('permission request failed');
  }
}

Future<SharedPreferences> _prefs() async {
  SharedPreferences.setMockInitialValues({});
  return SharedPreferences.getInstance();
}

Widget _wrap(Widget child, SharedPreferences prefs, PermissionService service) {
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      permissionServiceProvider.overrideWithValue(service),
    ],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
}

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
    'исключение при запросе разрешения сбрасывает _requesting — «Разрешить»/«Позже» не остаются заблокированными навсегда',
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

      // Экран сам гасит исключение (см. комментарий у `_allow`) — ничего
      // не должно долететь до тестовой зоны как необработанное, и
      // onFinished() не вызывается, раз попытка провалилась.
      expect(tester.takeException(), isNull);
      expect(finished, isFalse);

      final allowButton = tester.widget<SqButton>(
        find.widgetWithText(SqButton, l10n.actionAllow),
      );
      final laterButton = tester.widget<SqButton>(
        find.widgetWithText(SqButton, l10n.actionLater),
      );
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
}
