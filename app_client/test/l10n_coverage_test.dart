// Покрытие локализации: каждый ключ ARB должен быть где-то использован, а
// каждое обращение `l10n.<ключ>` в коде — существовать в ARB.
//
// Дополняет `core/arb_parity_test.dart` (сверяет два ARB между собой) и
// `core/arb_codegen_sync_test.dart` (сверяет ARB со сгенерированным
// кодом): здесь проверяется третья сторона — сами исходники приложения.
// Мёртвый ключ живёт в двух языках, тянет перевод и создаёт впечатление,
// что строка где-то показывается.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

Set<String> _arbKeys(String path) =>
    (jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>).keys
        .where((key) => !key.startsWith('@'))
        .toSet();

/// Все обращения к локализованным строкам в исходниках `lib/**` (кроме
/// сгенерированного каталога `lib/l10n`).
///
/// Ловит оба употребления: через локальную переменную `l10n.someKey` и
/// напрямую `AppLocalizations.of(context)!.someKey` — второй встречается в
/// обработчиках, где переменной нет.
Set<String> _usedKeys() {
  final used = <String>{};
  final pattern = RegExp(
    r'(?:l10n|AppLocalizations\.of\([^)]*\)!?)\.([a-zA-Z][a-zA-Z0-9_]*)',
  );
  for (final entity in Directory('lib').listSync(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) continue;
    if (entity.path.startsWith('lib/l10n/')) continue;
    for (final match in pattern.allMatches(entity.readAsStringSync())) {
      used.add(match.group(1)!);
    }
  }
  return used;
}

void main() {
  test('каждый ключ ARB используется в коде приложения', () {
    final keys = _arbKeys('l10n/app_ru.arb');
    final used = _usedKeys();

    // `appTitle` показывается через `onGenerateTitle` в `app.dart` тем же
    // способом, что и остальные, поэтому исключений здесь нет.
    final unused = keys.difference(used).toList()..sort();

    expect(
      unused,
      isEmpty,
      reason: 'мёртвые ключи локализации: их переводят и поддерживают, но '
          'ни один экран их не показывает',
    );
  });

  test('каждый ключ, использованный в коде, есть в обоих ARB', () {
    final ru = _arbKeys('l10n/app_ru.arb');
    final kk = _arbKeys('l10n/app_kk.arb');
    final used = _usedKeys();

    expect((used.difference(ru)).toList()..sort(), isEmpty);
    expect((used.difference(kk)).toList()..sort(), isEmpty);
  });
}
