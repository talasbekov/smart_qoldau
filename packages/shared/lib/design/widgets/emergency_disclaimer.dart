import 'package:flutter/material.dart';

import '../tokens.dart';
import 'button.dart';

/// Дисклеймер о том, что платформа не заменяет экстренные службы,
/// с кнопками быстрого звонка на 102 (полиция) и 103 (скорая помощь).
///
/// Виджет чисто визуальный: сами звонки инициирует вызывающая сторона
/// через [onCall102] / [onCall103] (например, через `url_launcher` —
/// это работа задачи 11, здесь никаких платформенных вызовов нет).
class SqEmergencyDisclaimer extends StatelessWidget {
  const SqEmergencyDisclaimer({super.key, this.onCall102, this.onCall103});

  final VoidCallback? onCall102;
  final VoidCallback? onCall103;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(SqSpacing.l),
      decoration: BoxDecoration(
        color: SqColors.surfaceMuted,
        borderRadius: BorderRadius.circular(SqRadius.l),
        border: Border.all(color: SqColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Платформа не заменяет экстренные службы. '
            'Если жизни или здоровью угрожает опасность, звоните напрямую:',
            style: SqTypography.body.copyWith(color: SqColors.textPrimary),
          ),
          const SizedBox(height: SqSpacing.m),
          Row(
            children: [
              Expanded(
                child: SqButton(
                  label: '102',
                  kind: SqButtonKind.danger,
                  onPressed: onCall102,
                ),
              ),
              const SizedBox(width: SqSpacing.s),
              Expanded(
                child: SqButton(
                  label: '103',
                  kind: SqButtonKind.danger,
                  onPressed: onCall103,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
