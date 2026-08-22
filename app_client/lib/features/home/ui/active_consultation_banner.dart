/// Баннер активной консультации на главном экране — виден, только когда
/// `HomeState.active` не `null`; ведёт в её сессию (`/session/:id`,
/// заглушка до задач 13/14 эпика E6).
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class ActiveConsultationBanner extends StatelessWidget {
  const ActiveConsultationBanner({
    super.key,
    required this.consultation,
    required this.onTap,
  });

  final ClientConsultation consultation;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return InkWell(
      key: const Key('sq-active-consultation-banner'),
      onTap: onTap,
      borderRadius: BorderRadius.circular(SqRadius.l),
      child: SqCard(
        child: Row(
          children: [
            const Icon(Icons.forum, color: SqColors.primary),
            const SizedBox(width: SqSpacing.m),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.homeActiveConsultationTitle,
                    style: SqTypography.title,
                  ),
                  const SizedBox(height: SqSpacing.xs),
                  Text(
                    consultation.expert.displayName,
                    style: SqTypography.caption.copyWith(
                      color: SqColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: SqColors.textTertiary),
          ],
        ),
      ),
    );
  }
}
