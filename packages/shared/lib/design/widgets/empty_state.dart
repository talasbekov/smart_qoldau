import 'package:flutter/material.dart';

import '../tokens.dart';

/// Заглушка для пустого состояния списков и экранов.
class SqEmptyState extends StatelessWidget {
  const SqEmptyState({
    super.key,
    required this.title,
    this.subtitle,
    this.icon = Icons.inbox_outlined,
  });

  final String title;
  final String? subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 48, color: SqColors.textTertiary),
        const SizedBox(height: SqSpacing.m),
        Text(
          title,
          textAlign: TextAlign.center,
          style: SqTypography.title.copyWith(color: SqColors.textPrimary),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: SqSpacing.xs),
          Text(
            subtitle!,
            textAlign: TextAlign.center,
            style: SqTypography.body.copyWith(color: SqColors.textSecondary),
          ),
        ],
      ],
    );
  }
}
