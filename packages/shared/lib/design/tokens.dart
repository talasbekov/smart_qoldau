/// Дизайн-токены SmartQoldau: цвета, отступы, радиусы и типографика,
/// снятые с прототипа интерфейса (`docs/Прототип/*.dc.html`).
library;

import 'package:flutter/material.dart';
import 'fonts.dart';

/// Палитра прототипа.
class SqColors {
  const SqColors._();

  static const Color primary = Color(0xFF0F766E);
  static const Color primaryDark = Color(0xFF0F3F3A);
  static const Color accent = Color(0xFF159A7C);
  static const Color danger = Color(0xFFC0392B);
  static const Color background = Color(0xFFFAFCFB);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFEDF2F0);
  static const Color chipBg = Color(0xFFE3F3EE);
  static const Color border = Color(0xFFC7D3CF);
  static const Color textPrimary = Color(0xFF0F3F3A);
  static const Color textSecondary = Color(0xFF6B8580);
  static const Color textTertiary = Color(0xFF8FA6A1);
}

/// Шкала отступов прототипа.
class SqSpacing {
  const SqSpacing._();

  static const double xs = 4;
  static const double s = 8;
  static const double m = 12;
  static const double l = 16;
  static const double xl = 24;
  static const double xxl = 32;
}

/// Шкала радиусов скругления прототипа.
class SqRadius {
  const SqRadius._();

  static const double s = 8;
  static const double m = 12;
  static const double l = 16;
  static const double pill = 999;
}

/// Типографическая шкала прототипа на гарнитуре Inter.
///
/// Размер и межстрочный интервал заданы парой `size/lineHeight`; в Flutter
/// `TextStyle.height` — множитель от `fontSize`, поэтому пересчитываем его
/// как `lineHeight / size`.
///
/// Стили — `static const`: с задачи 21 шрифт забандлен в пакет, никакой
/// сетевой загрузки и подбора ближайшего начертания больше нет, поэтому
/// стили строятся на этапе компиляции (раньше здесь была мемоизация ради
/// небесплатного `GoogleFonts.inter()`).
class SqTypography {
  const SqTypography._();

  static const TextStyle h1 = TextStyle(
    fontFamily: sqFontFamily,
    fontSize: 28,
    height: 34 / 28,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle h2 = TextStyle(
    fontFamily: sqFontFamily,
    fontSize: 22,
    height: 28 / 22,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle title = TextStyle(
    fontFamily: sqFontFamily,
    fontSize: 17,
    height: 22 / 17,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle body = TextStyle(
    fontFamily: sqFontFamily,
    fontSize: 15,
    height: 22 / 15,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: sqFontFamily,
    fontSize: 13,
    height: 18 / 13,
    fontWeight: FontWeight.w400,
  );
}
