// Дымовой тест: приложение эксперта строится и отдаёт корневой MaterialApp
// (через MaterialApp.router — go_router).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_expert/app.dart';
import 'package:app_expert/core/locale_controller.dart';
import 'package:app_expert/core/providers.dart';
import 'package:app_expert/core/token_store.dart';

/// Секьюрное хранилище в памяти — только чтобы `SplashScreen` (стартовый
/// маршрут) не упирался в платформенный `flutter_secure_storage`,
/// недоступный в `flutter test` (см. `core/token_store.dart`).
class _FakeSecureStore implements SecureStore {
  final Map<String, String> data = {};

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async => data[key] = value;

  @override
  Future<void> delete(String key) async => data.remove(key);
}

void main() {
  testWidgets('SqExpertApp строится и содержит MaterialApp', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          secureStoreProvider.overrideWithValue(_FakeSecureStore()),
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
        child: const SqExpertApp(),
      ),
    );

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
