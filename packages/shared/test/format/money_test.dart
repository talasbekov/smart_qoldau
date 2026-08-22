import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

void main() {
  group('formatTenge', () {
    test('groups thousands with a non-breaking space and drops tiyn', () {
      // U+00A0 (неразрывный пробел) пишем явным escape-литералом, чтобы
      // правка не потерялась при копировании (визуально неотличим от
      // обычного пробела).
      expect(formatTenge(399000), '3\u00A0990\u00A0₸');
    });

    test('formats zero without a thousands separator', () {
      expect(formatTenge(0), '0\u00A0₸');
    });

    test('groups larger amounts correctly', () {
      expect(formatTenge(1500000), '15\u00A0000\u00A0₸');
    });

    test('drops a non-zero tiyn remainder instead of rounding', () {
      // 100450 tiyn = 1004.5 tenge — все прочие кейсы кратны 100 тиынам и
      // не проверяют собственно отбрасывание остатка, только группировку.
      expect(formatTenge(100450), '1\u00A0004\u00A0₸');
    });
  });
}
