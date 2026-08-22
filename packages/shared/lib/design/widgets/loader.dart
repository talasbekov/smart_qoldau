import 'package:flutter/material.dart';

import '../tokens.dart';

/// Индикатор загрузки дизайн-системы SmartQoldau.
class SqLoader extends StatelessWidget {
  const SqLoader({super.key, this.size = 32});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: size,
        height: size,
        child: const CircularProgressIndicator(
          strokeWidth: 3,
          valueColor: AlwaysStoppedAnimation<Color>(SqColors.primary),
        ),
      ),
    );
  }
}
