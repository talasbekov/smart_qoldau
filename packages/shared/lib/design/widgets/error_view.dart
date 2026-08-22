import 'package:flutter/material.dart';

import '../tokens.dart';
import 'button.dart';

/// Отображение ошибки с опциональной кнопкой повтора.
class SqErrorView extends StatelessWidget {
  const SqErrorView({super.key, required this.text, this.onRetry});

  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.error_outline, size: 48, color: SqColors.danger),
        const SizedBox(height: SqSpacing.m),
        Text(
          text,
          textAlign: TextAlign.center,
          style: SqTypography.body.copyWith(color: SqColors.textPrimary),
        ),
        if (onRetry != null) ...[
          const SizedBox(height: SqSpacing.l),
          SqButton(
            label: 'Повторить',
            kind: SqButtonKind.secondary,
            onPressed: onRetry,
          ),
        ],
      ],
    );
  }
}
