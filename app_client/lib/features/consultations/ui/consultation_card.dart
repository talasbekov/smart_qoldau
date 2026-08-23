/// Карточка консультации в списке и человекочитаемые подписи статусов.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

/// Локализованный статус консультации.
String consultationStatusLabel(
  AppLocalizations l10n,
  ConsultationStatus status,
) => switch (status) {
  ConsultationStatus.scheduled => l10n.consultationScheduled,
  ConsultationStatus.active => l10n.consultationStatusActive,
  ConsultationStatus.completed => l10n.consultationStatusCompleted,
  ConsultationStatus.cancelled => l10n.consultationStatusCancelled,
};

/// Локализованный исход завершённой консультации.
String consultationOutcomeLabel(
  AppLocalizations l10n,
  ConsultationOutcome outcome,
) => switch (outcome) {
  ConsultationOutcome.completed => l10n.outcomeCompleted,
  ConsultationOutcome.clientNoShow => l10n.outcomeClientNoShow,
  ConsultationOutcome.clientCancelled => l10n.outcomeClientCancelled,
  ConsultationOutcome.techIssue => l10n.outcomeTechIssue,
  ConsultationOutcome.expertCancelled => l10n.outcomeExpertCancelled,
};

/// Локализованный платёжный статус — клиенту, а не бухгалтерии: «HELD»
/// человеку ничего не говорит.
String paymentStatusLabel(
  AppLocalizations l10n,
  ConsultationPaymentStatus status,
) => switch (status) {
  ConsultationPaymentStatus.unpaid => l10n.paymentStatusUnpaid,
  ConsultationPaymentStatus.held => l10n.paymentStatusHeld,
  ConsultationPaymentStatus.captured => l10n.paymentStatusCaptured,
  ConsultationPaymentStatus.voided => l10n.paymentStatusVoided,
  ConsultationPaymentStatus.failed => l10n.paymentStatusFailed,
};

IconData formatIcon(SessionFormat format) => switch (format) {
  SessionFormat.chat => Icons.chat_bubble_outline,
  SessionFormat.audio => Icons.headset_outlined,
  SessionFormat.video => Icons.videocam_outlined,
};

/// Дата и время начала в часовом поясе Астаны (UTC+5).
///
/// Бэкенд отдаёт `startedAt` в UTC, а весь продукт живёт в одном поясе
/// (ТЗ: Asia/Almaty = UTC+5, перехода на летнее время в Казахстане нет),
/// поэтому фиксированное смещение здесь корректно и не требует тащить
/// базу часовых поясов в приложение.
String formatAlmatyDateTime(DateTime value) {
  final local = value.toUtc().add(const Duration(hours: 5));
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(local.day)}.${two(local.month)}.${local.year}, '
      '${two(local.hour)}:${two(local.minute)}';
}

/// Человекочитаемый отсчёт до начала: «2 ч 15 мин», «45 мин».
String? startsInLabel(
  AppLocalizations l10n,
  DateTime startedAt,
  DateTime now,
) {
  final left = startedAt.difference(now);
  if (left.isNegative) return null;
  final hours = left.inHours;
  final minutes = left.inMinutes % 60;
  final text = hours > 0 ? '$hours ч $minutes мин' : '$minutes мин';
  return l10n.consultationStartsIn(text);
}

class ConsultationCard extends StatelessWidget {
  const ConsultationCard({
    super.key,
    required this.consultation,
    required this.onTap,
    this.now,
    this.onContinue,
    this.onCancel,
    this.onReschedule,
    this.onPay,
    this.onRepeat,
  });

  final ClientConsultation consultation;
  final VoidCallback onTap;

  /// Момент отсчёта до начала плановой записи; `null` — отсчёт не рисуется.
  final DateTime? now;

  final VoidCallback? onContinue;
  final VoidCallback? onCancel;
  final VoidCallback? onReschedule;
  final VoidCallback? onPay;
  final VoidCallback? onRepeat;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: const EdgeInsets.only(bottom: SqSpacing.m),
      child: InkWell(
        key: Key('sq-consultation-card-${consultation.id}'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(SqRadius.m),
        child: SqCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  SqAvatar(name: consultation.expert.displayName, size: 44),
                  const SizedBox(width: SqSpacing.m),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          consultation.expert.displayName,
                          style: SqTypography.title,
                        ),
                        const SizedBox(height: SqSpacing.xs),
                        Row(
                          children: [
                            Icon(
                              formatIcon(consultation.format),
                              size: 14,
                              color: SqColors.textSecondary,
                            ),
                            const SizedBox(width: SqSpacing.xs),
                            Flexible(
                              child: Text(
                                formatAlmatyDateTime(consultation.startedAt),
                                style: SqTypography.caption.copyWith(
                                  color: SqColors.textSecondary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Text(
                    formatTenge(consultation.priceTiyn),
                    style: SqTypography.title,
                  ),
                ],
              ),
              const SizedBox(height: SqSpacing.m),
              Wrap(
                spacing: SqSpacing.s,
                runSpacing: SqSpacing.s,
                children: [
                  SqChip(
                    label: consultation.outcome != null
                        ? consultationOutcomeLabel(l10n, consultation.outcome!)
                        : consultationStatusLabel(l10n, consultation.status),
                  ),
                  SqChip(
                    label: paymentStatusLabel(
                      l10n,
                      consultation.paymentStatus,
                    ),
                  ),
                ],
              ),
              if (consultation.status == ConsultationStatus.scheduled &&
                  now != null)
                if (startsInLabel(l10n, consultation.startedAt, now!)
                    case final countdown?) ...[
                  const SizedBox(height: SqSpacing.xs),
                  Text(
                    countdown,
                    key: Key('sq-consultation-countdown-${consultation.id}'),
                    style: SqTypography.caption.copyWith(
                      color: SqColors.textSecondary,
                    ),
                  ),
                ],
              if (onContinue != null ||
                  onCancel != null ||
                  onReschedule != null ||
                  onPay != null ||
                  onRepeat != null) ...[
                const SizedBox(height: SqSpacing.m),
                Wrap(
                  spacing: SqSpacing.m,
                  children: [
                    if (onPay != null)
                      TextButton(
                        key: Key('sq-consultation-pay-${consultation.id}'),
                        onPressed: onPay,
                        child: Text(l10n.paymentPay),
                      ),
                    if (onContinue != null)
                      TextButton(
                        key: Key('sq-consultation-continue-${consultation.id}'),
                        onPressed: onContinue,
                        child: Text(l10n.consultationContinue),
                      ),
                    if (onRepeat != null)
                      TextButton(
                        key: Key('sq-consultation-repeat-${consultation.id}'),
                        onPressed: onRepeat,
                        child: Text(l10n.consultationRepeat),
                      ),
                    if (onReschedule != null)
                      TextButton(
                        key: Key(
                          'sq-consultation-reschedule-${consultation.id}',
                        ),
                        onPressed: onReschedule,
                        child: Text(l10n.rescheduleConfirm),
                      ),
                    if (onCancel != null)
                      TextButton(
                        key: Key('sq-consultation-cancel-${consultation.id}'),
                        onPressed: onCancel,
                        child: Text(
                          l10n.consultationCancel,
                          style: const TextStyle(color: SqColors.danger),
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
