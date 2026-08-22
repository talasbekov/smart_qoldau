/// Светлая тема Material для приложений SmartQoldau, построенная
/// на дизайн-токенах прототипа ([SqColors], [SqTypography]).
library;

import 'package:flutter/material.dart';
import 'fonts.dart';
import 'tokens.dart';

ThemeData? _cachedTheme;

/// Собирает `ThemeData` прототипа: светлая тема, фон сцены —
/// [SqColors.background], типографика — [SqTypography] на базе Inter.
///
/// Результат кешируется на первый вызов: тема неизменна, а сборка
/// `ThemeData` не бесплатна. С задачи 21 шрифт забандлен в пакет, поэтому
/// семейство просто проставляется всему `TextTheme` — без сети и без
/// подбора начертаний в рантайме.
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
    // `apply` вместо `GoogleFonts.interTextTheme`: тот подменял каждый
    // стиль темы загруженным начертанием, здесь достаточно проставить
    // забандленное семейство всем стилям сразу.
    textTheme: base.textTheme.apply(fontFamily: sqFontFamily).copyWith(
      headlineMedium: SqTypography.h1,
      headlineSmall: SqTypography.h2,
      titleLarge: SqTypography.title,
      bodyLarge: SqTypography.body,
      bodySmall: SqTypography.caption,
    ),
  );
}
