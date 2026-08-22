import 'package:flutter/material.dart';

import '../tokens.dart';

/// Карточка-поверхность дизайн-системы SmartQoldau.
class SqCard extends StatelessWidget {
  const SqCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(SqSpacing.l),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: SqColors.surface,
        borderRadius: BorderRadius.circular(SqRadius.l),
        border: Border.all(color: SqColors.border),
      ),
      child: child,
    );
  }
}
