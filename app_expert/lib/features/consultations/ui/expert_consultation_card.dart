/// Карточка консультации в списке эксперта (E7 задача 12) — раздел «Идёт
/// сейчас»/«Плановые» и «История». Не показывает имя/телефон клиента —
/// только `clientCode` (PII-инвариант, см. `ConsultationExpertDto`).
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';

class ExpertConsultationCard extends StatelessWidget {
  const ExpertConsultationCard({super.key, required this.consultation});

  final ConsultationExpertDto consultation;

  String _statusLabel(AppLocalizations l10n) => switch (consultation.status) {
        ConsultationStatus.scheduled => l10n.consultationStatusScheduled,
        ConsultationStatus.active => l10n.consultationStatusActive,
        ConsultationStatus.completed => l10n.consultationStatusCompleted,
        ConsultationStatus.cancelled => l10n.consultationStatusCancelled,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    // Открыть сессию (чат) есть смысл только для ACTIVE — SCHEDULED ещё не
    // началась (нет переписки, `GET /consultations/{id}/messages` не
    // предмет плановой записи), COMPLETED/CANCELLED — история для чтения,
    // а не действий (задача 13 не заводит режим «только просмотр»).
    return InkWell(
      onTap: consultation.status == ConsultationStatus.active
          ? () => context.push(RoutePaths.session(consultation.id))
          : null,
      borderRadius: BorderRadius.circular(SqRadius.m),
      child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SqColors.surface,
        borderRadius: BorderRadius.circular(SqRadius.m),
        border: Border.all(color: SqColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(consultation.topicSlug, style: SqTypography.title),
              Text(l10n.clientCode(consultation.clientCode), style: SqTypography.caption),
            ],
          ),
          const SizedBox(height: 4),
          Text(_statusLabel(l10n), style: SqTypography.body.copyWith(color: SqColors.textSecondary)),
          const SizedBox(height: 4),
          Text(
            formatTenge(consultation.priceTiyn),
            style: SqTypography.body,
          ),
        ],
      ),
      ),
    );
  }
}
