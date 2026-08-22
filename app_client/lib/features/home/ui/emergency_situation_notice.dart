/// Информационная панель «Экстренная ситуация» на главном экране
/// (прототип `07-home.png`): напоминание, что специалисты готовы
/// подключиться в приоритетном порядке. Отдельно от `SqEmergencyDisclaimer`
/// (телефоны 102/103 внизу экрана) — это другой блок того же прототипа,
/// чисто информационный, без кнопок и колбэков.
///
/// Не украшение: экстренные дисклеймеры — требование ТЗ §4.3, ревью раунда 1
/// задачи 7 эпика E6 указало на пропуск этого блока при первой сверке с
/// прототипом.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class EmergencySituationNotice extends StatelessWidget {
  const EmergencySituationNotice({super.key});

  /// Бледно-розовый фон/рамка прототипа — токена под них в `SqColors` пока
  /// нет (дизайн-система задачи 2 не заводила отдельную "приглушённую"
  /// версию `SqColors.danger`), а заводить новый общий токен ради одной
  /// панели одного экрана — больше, чем требует задача. Цвета локальны
  /// этому файлу.
  static const _background = Color(0xFFFDECEA);
  static const _border = Color(0xFFF3C6C0);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Container(
      key: const Key('sq-home-emergency-notice'),
      padding: const EdgeInsets.all(SqSpacing.l),
      decoration: BoxDecoration(
        color: _background,
        borderRadius: BorderRadius.circular(SqRadius.l),
        border: Border.all(color: _border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.favorite, color: SqColors.danger),
          const SizedBox(width: SqSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.homeEmergencyNoticeTitle,
                  style: SqTypography.title.copyWith(color: SqColors.danger),
                ),
                const SizedBox(height: SqSpacing.xs),
                Text(
                  l10n.homeEmergencyNoticeBody,
                  style: SqTypography.body.copyWith(color: SqColors.danger),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
