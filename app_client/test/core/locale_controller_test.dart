import 'dart:ui' show Locale;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';

/// Фейковый порт синхронизации локали с бэкендом — записывает вызовы вместо
/// реального HTTP (`SqApi` появится в задаче 4, реальную реализацию
/// подключит задача 19).
class _FakeLocaleSync implements LocaleSyncPort {
  final List<String> pushed = [];
  Object? throwOnPush;

  @override
  Future<void> pushLocale(String apiLocale) async {
    pushed.add(apiLocale);
    final error = throwOnPush;
    if (error != null) {
      throw error;
    }
  }
}

Future<ProviderContainer> _makeContainer({
  Map<String, Object> initialPrefs = const {},
  Locale systemLocale = const Locale('ru'),
  LocaleSyncPort? syncPort,
}) async {
  SharedPreferences.setMockInitialValues(initialPrefs);
  final prefs = await SharedPreferences.getInstance();

  final container = ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      systemLocaleProvider.overrideWithValue(systemLocale),
      if (syncPort != null) localeSyncPortProvider.overrideWithValue(syncPort),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('LocaleController', () {
    test('стартует с локали, сохранённой в SharedPreferences', () async {
      final container = await _makeContainer(
        initialPrefs: {'sq.locale': 'kk'},
        systemLocale: const Locale('ru'),
      );

      expect(container.read(localeControllerProvider), const Locale('kk'));
    });

    test('без сохранённой локали берёт системную казахскую', () async {
      final container = await _makeContainer(systemLocale: const Locale('kk'));

      expect(container.read(localeControllerProvider), const Locale('kk'));
    });

    test('без сохранённой локали любая не-kk системная даёт русский', () async {
      final container = await _makeContainer(systemLocale: const Locale('en'));

      expect(container.read(localeControllerProvider), const Locale('ru'));
    });

    test('setLocale персистит выбор в SharedPreferences', () async {
      final container = await _makeContainer();

      await container
          .read(localeControllerProvider.notifier)
          .setLocale(const Locale('kk'));

      expect(container.read(localeControllerProvider), const Locale('kk'));
      final prefs = container.read(sharedPreferencesProvider);
      expect(prefs.getString('sq.locale'), 'kk');
    });

    test('setLocale вызывает LocaleSyncPort с kz при выборе казахского', () async {
      final fake = _FakeLocaleSync();
      final container = await _makeContainer(syncPort: fake);

      await container
          .read(localeControllerProvider.notifier)
          .setLocale(const Locale('kk'));

      expect(fake.pushed, ['kz']);
    });

    test('setLocale глотает ошибку синхронизации с бэкендом', () async {
      final fake = _FakeLocaleSync()..throwOnPush = Exception('network down');
      final container = await _makeContainer(syncPort: fake);

      await expectLater(
        container
            .read(localeControllerProvider.notifier)
            .setLocale(const Locale('ru')),
        completes,
      );
      expect(fake.pushed, ['ru']);
    });
  });
}
