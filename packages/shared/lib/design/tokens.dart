/// Дизайн-токены SmartQoldau: цвета, отступы, радиусы и типографика,
/// снятые с прототипа интерфейса (`docs/Прототип/*.dc.html`).
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

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
/// Стили — `static final`, а не `static TextStyle get`: `GoogleFonts.inter()`
/// не бесплатен (внутри ищет ближайший вариант начертания и запускает
/// попытку подгрузить шрифт), а memo-геттер вычисляет его ровно один раз
/// на всё время жизни процесса вместо пересчёта на каждый доступ/ребилд.
class SqTypography {
  const SqTypography._();

  static final TextStyle h1 = GoogleFonts.inter(
    fontSize: 28,
    height: 34 / 28,
    fontWeight: FontWeight.w700,
  );

  static final TextStyle h2 = GoogleFonts.inter(
    fontSize: 22,
    height: 28 / 22,
    fontWeight: FontWeight.w600,
  );

  static final TextStyle title = GoogleFonts.inter(
    fontSize: 17,
    height: 22 / 17,
    fontWeight: FontWeight.w600,
  );

  static final TextStyle body = GoogleFonts.inter(
    fontSize: 15,
    height: 22 / 15,
    fontWeight: FontWeight.w400,
  );

  static final TextStyle caption = GoogleFonts.inter(
    fontSize: 13,
    height: 18 / 13,
    fontWeight: FontWeight.w400,
  );
}
