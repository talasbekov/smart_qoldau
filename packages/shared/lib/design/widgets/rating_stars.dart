import 'package:flutter/material.dart';

import '../tokens.dart';

/// Ряд звёзд рейтинга дизайн-системы SmartQoldau.
///
/// [value] округляется до ближайшего целого числа закрашенных звёзд из
/// [count] возможных.
class SqRatingStars extends StatelessWidget {
  const SqRatingStars({super.key, required this.value, this.count = 5});

  final double value;
  final int count;

  @override
  Widget build(BuildContext context) {
    final filled = value.round().clamp(0, count);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (index) {
        final isFilled = index < filled;
        return Icon(
          isFilled ? Icons.star : Icons.star_border,
          color: SqColors.accent,
          size: 20,
        );
      }),
    );
  }
}
