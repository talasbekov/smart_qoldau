import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/app.dart';
import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/core/providers.dart';
import 'package:app_client/core/token_store.dart';

/// `SqClientApp` теперь стартует с `SplashScreen`, который сразу же
/// вызывает `AuthController.restore()` — тот, в свою очередь, читает
/// `secureStoreProvider`. Без подмены это настоящий `flutter_secure_storage`
/// на платформенном канале, которого в `flutter test` не существует.
class _FakeSecureStore implements SecureStore {
  @override
  Future<String?> read(String key) async => null;

  @override
  Future<void> write(String key, String value) async {}

  @override
  Future<void> delete(String key) async {}
}

void main() {
  testWidgets('SqClientApp renders a themed MaterialApp', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          secureStoreProvider.overrideWithValue(_FakeSecureStore()),
        ],
        child: const SqClientApp(),
      ),
    );

    expect(find.byType(MaterialApp), findsOneWidget);

    final materialApp = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(materialApp.theme, isNotNull);
    expect(materialApp.theme!.scaffoldBackgroundColor, SqColors.background);
  });
}
