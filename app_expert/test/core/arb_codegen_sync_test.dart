import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:app_expert/l10n/app_localizations_kk.dart';
import 'package:app_expert/l10n/app_localizations_ru.dart';

/// Страховка от расхождения `l10n/*.arb` и сгенерированного `lib/l10n/*.dart`
/// в локальном `flutter test` — копия
/// `app_client/test/core/arb_codegen_sync_test.dart` (задача 17 эпика E7).
/// Тест паритета ARB (`arb_parity_test.dart`) сверяет только набор ключей
/// двух ARB между собой и никогда — с Dart-кодом, поэтому забытый
/// `flutter gen-l10n` после правки ARB не ловится ничем, кроме этого теста.
void main() {
  Map<String, dynamic> arb(String path) =>
      jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

  group('сгенерированный AppLocalizations синхронен с ARB', () {
    test('ru: значения ключей совпадают с app_ru.arb', () {
      final source = arb('l10n/app_ru.arb');
      final generated = AppLocalizationsRu();

      expect(generated.appTitle, source['appTitle']);
    });

    test('kk: значения ключей совпадают с app_kk.arb', () {
      final source = arb('l10n/app_kk.arb');
      final generated = AppLocalizationsKk();

      expect(generated.appTitle, source['appTitle']);
    });
  });
}
