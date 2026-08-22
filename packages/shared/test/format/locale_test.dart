import 'dart:ui' show Locale;

import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

void main() {
  group('localeToApi', () {
    test('kk (казахский) переводится в kz', () {
      expect(localeToApi(const Locale('kk')), 'kz');
    });

    test('ru остаётся ru', () {
      expect(localeToApi(const Locale('ru')), 'ru');
    });

    test('любая другая локаль откатывается на ru', () {
      expect(localeToApi(const Locale('en')), 'ru');
    });
  });
}
