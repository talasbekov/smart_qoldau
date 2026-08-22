/// Форматирование денежных сумм SmartQoldau.
///
/// Деньги в системе всегда хранятся как `int` в тиынах — без `double`,
/// чтобы не терять точность на арифметике с плавающей точкой.
library;

/// Форматирует сумму в тиынах [tiyn] как строку в тенге для показа
/// пользователю: `399000 -> '3\u00A0990\u00A0₸'`.
///
/// Тиыны отбрасываются вниз (целочисленное деление), тысячи разделяются
/// неразрывным пробелом (U+00A0), он же отделяет число от знака ₸.
String formatTenge(int tiyn) {
  final tenge = tiyn ~/ 100;
  final isNegative = tenge < 0;
  final digits = tenge.abs().toString();

  final grouped = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) {
      // U+00A0 явным escape-литералом — иначе невидимый символ легко
      // случайно заменить обычным пробелом при правке.
      grouped.write('\u00A0');
    }
    grouped.write(digits[i]);
  }

  final sign = isNegative ? '-' : '';
  return '$sign$grouped\u00A0₸';
}
