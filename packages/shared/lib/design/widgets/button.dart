import 'package:flutter/material.dart';

import '../tokens.dart';

/// Визуальный вариант [SqButton].
enum SqButtonKind { primary, secondary, danger, ghost }

class _SqButtonPalette {
  const _SqButtonPalette({
    required this.background,
    required this.foreground,
    this.border,
  });

  final Color background;
  final Color foreground;
  final BoxBorder? border;
}

_SqButtonPalette _paletteFor(SqButtonKind kind) {
  switch (kind) {
    case SqButtonKind.primary:
      return const _SqButtonPalette(
        background: SqColors.primary,
        foreground: Colors.white,
      );
    case SqButtonKind.secondary:
      return _SqButtonPalette(
        background: SqColors.surface,
        foreground: SqColors.primaryDark,
        border: Border.all(color: SqColors.border),
      );
    case SqButtonKind.danger:
      return const _SqButtonPalette(
        background: SqColors.danger,
        foreground: Colors.white,
      );
    case SqButtonKind.ghost:
      return const _SqButtonPalette(
        background: Colors.transparent,
        foreground: SqColors.primaryDark,
      );
  }
}

/// Кнопка дизайн-системы SmartQoldau.
///
/// Пока [loading] равен `true`, кнопка показывает индикатор вместо текста
/// и не реагирует на тап (см. `onPressed` — становится `null`).
class SqButton extends StatelessWidget {
  const SqButton({
    super.key,
    required this.label,
    this.onPressed,
    this.kind = SqButtonKind.primary,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final SqButtonKind kind;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final palette = _paletteFor(kind);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(SqRadius.m),
        onTap: loading ? null : onPressed,
        child: Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: SqSpacing.l),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: palette.background,
            borderRadius: BorderRadius.circular(SqRadius.m),
            border: palette.border,
          ),
          child: loading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      palette.foreground,
                    ),
                  ),
                )
              : Text(
                  label,
                  style: SqTypography.title.copyWith(color: palette.foreground),
                ),
        ),
      ),
    );
  }
}
