import 'package:flutter/material.dart';

import '../tokens.dart';

/// Чип-тег дизайн-системы SmartQoldau (например, для фильтров и тем).
class SqChip extends StatelessWidget {
  const SqChip({super.key, required this.label, this.selected = false});

  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SqSpacing.m,
        vertical: SqSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: selected ? SqColors.primary : SqColors.chipBg,
        borderRadius: BorderRadius.circular(SqRadius.pill),
      ),
      child: Text(
        label,
        style: SqTypography.caption.copyWith(
          color: selected ? Colors.white : SqColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
