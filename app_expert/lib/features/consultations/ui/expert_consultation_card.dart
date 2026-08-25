/// Карточка консультации в списке эксперта (E7 задача 12) — раздел «Идёт
/// сейчас»/«Плановые» и «История». Не показывает имя/телефон клиента —
/// только `clientCode` (PII-инвариант, см. `ConsultationExpertDto`).
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';

class ExpertConsultationCard extends StatelessWidget {
  const ExpertConsultationCard({super.key, required this.consultation});

  final ConsultationExpertDto consultation;

  String get _statusLabel => switch (consultation.status) {
        ConsultationStatus.scheduled => 'Плановая запись',
        ConsultationStatus.active => 'Идёт сейчас',
        ConsultationStatus.completed => 'Завершена',
        ConsultationStatus.cancelled => 'Отменена',
      };

  @override
  Widget build(BuildContext context) {
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
              Text('Клиент #${consultation.clientCode}', style: SqTypography.caption),
            ],
          ),
          const SizedBox(height: 4),
          Text(_statusLabel, style: SqTypography.body.copyWith(color: SqColors.textSecondary)),
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
