/// Светлая тема Material для приложений SmartQoldau, построенная
/// на дизайн-токенах прототипа ([SqColors], [SqTypography]).
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

ThemeData? _cachedTheme;

/// Собирает `ThemeData` прототипа: светлая тема, фон сцены —
/// [SqColors.background], типографика — [SqTypography] на базе Inter.
///
/// Результат кешируется на первый вызов: тема неизменна, а
/// `GoogleFonts.interTextTheme()` внутри — недешёвая операция (подбирает
/// начертания под весь `TextTheme` и запускает попытки подгрузить шрифт),
/// пересчитывать её на каждый вызов незачем.
ThemeData sqTheme() => _cachedTheme ??= _buildTheme();

ThemeData _buildTheme() {
  final colorScheme =
      ColorScheme.fromSeed(
        seedColor: SqColors.primary,
        brightness: Brightness.light,
      ).copyWith(
        primary: SqColors.primary,
        error: SqColors.danger,
        surface: SqColors.surface,
      );

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: SqColors.background,
  );

  return base.copyWith(
    textTheme: GoogleFonts.interTextTheme(base.textTheme).copyWith(
      headlineMedium: SqTypography.h1,
      headlineSmall: SqTypography.h2,
      titleLarge: SqTypography.title,
      bodyLarge: SqTypography.body,
      bodySmall: SqTypography.caption,
    ),
  );
}
