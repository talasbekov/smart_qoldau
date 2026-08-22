import 'package:flutter/material.dart';

import '../tokens.dart';
import 'button.dart';

/// Отображение ошибки с опциональной кнопкой повтора.
///
/// [retryLabel] по умолчанию — жёстко зашитая русская строка: пакет `shared`
/// не может зависеть от `l10n` конкретного приложения (у `app_client` и
/// будущих приложений эпика E7/E8 — разные сгенерированные `AppLocalizations`),
/// поэтому перевод остаётся ответственностью вызывающей стороны. Приложение,
/// которому нужна казахская локаль (`app_client`), обязано передавать свой
/// локализованный текст явно — см. `HomeScreen` в `app_client`, где
/// `retryLabel: l10n.actionRetry`. Значение по умолчанию сохранено, чтобы
/// существующие вызовы без этого параметра не сломались (ревью раунда 1
/// задачи 7 эпика E6).
class SqErrorView extends StatelessWidget {
  const SqErrorView({
    super.key,
    required this.text,
    this.onRetry,
    this.retryLabel = 'Повторить',
  });

  final String text;
  final VoidCallback? onRetry;
  final String retryLabel;

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
            label: retryLabel,
            kind: SqButtonKind.secondary,
            onPressed: onRetry,
          ),
        ],
      ],
    );
  }
}
