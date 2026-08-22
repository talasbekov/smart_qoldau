import 'package:flutter/material.dart';

import '../tokens.dart';

/// Текстовое поле ввода дизайн-системы SmartQoldau.
class SqTextField extends StatelessWidget {
  const SqTextField({
    super.key,
    this.label,
    this.hint,
    this.controller,
    this.obscureText = false,
    this.errorText,
    this.onChanged,
    this.keyboardType,
  });

  final String? label;
  final String? hint;
  final TextEditingController? controller;
  final bool obscureText;
  final String? errorText;
  final ValueChanged<String>? onChanged;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscureText,
      onChanged: onChanged,
      keyboardType: keyboardType,
      style: SqTypography.body.copyWith(color: SqColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        errorText: errorText,
        filled: true,
        fillColor: SqColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: SqSpacing.m,
          vertical: SqSpacing.m,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SqRadius.m),
          borderSide: const BorderSide(color: SqColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SqRadius.m),
          borderSide: const BorderSide(color: SqColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SqRadius.m),
          borderSide: const BorderSide(color: SqColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SqRadius.m),
          borderSide: const BorderSide(color: SqColors.danger),
        ),
      ),
    );
  }
}
