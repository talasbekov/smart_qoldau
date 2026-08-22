/// Баннер состояния соединения звонка.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

class ConnectionBanner extends StatelessWidget {
  const ConnectionBanner({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    color: SqColors.surfaceMuted,
    padding: const EdgeInsets.all(SqSpacing.m),
    child: Text(
      text,
      style: SqTypography.body.copyWith(color: SqColors.textSecondary),
      textAlign: TextAlign.center,
    ),
  );
}
