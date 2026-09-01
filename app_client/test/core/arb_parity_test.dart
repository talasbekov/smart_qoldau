import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('наборы ключей ru и kk совпадают', () {
    Set<String> keys(String path) =>
        (jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>).keys
            .where((k) => !k.startsWith('@'))
            .toSet();
    final ru = keys('l10n/app_ru.arb');
    final kk = keys('l10n/app_kk.arb');
    expect(kk.difference(ru), isEmpty, reason: 'лишние ключи в kk');
    expect(ru.difference(kk), isEmpty, reason: 'непереведённые ключи');
  });
}
