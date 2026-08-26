/// Выбор исхода активной консультации (E7 задача 13) — открывается из меню
/// сессии вместо клиентского «отменить».
///
/// Только исходы, принимаемые `POST /consultations/{id}/complete`
/// (`COMPLETED`/`CLIENT_NO_SHOW`/`CLIENT_CANCELLED`/`TECH_ISSUE`) —
/// `EXPERT_CANCELLED` в перечень НЕ включён: это отдельный эндпоинт
/// `POST /consultations/{id}/cancel-by-expert` для ПЛАНОВОЙ (`SCHEDULED`)
/// консультации, которая ещё не началась (нет активной сессии, которую
/// можно было бы «завершить» — см. `ConsultationsController.cancelByExpert`
/// бэкенда); эта шторка открывается из УЖЕ идущей сессии.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../data/expert_consultations_repository.dart';

List<(ConsultationOutcome, String)> _outcomes(AppLocalizations l10n) => [
  (ConsultationOutcome.completed, l10n.outcomeCompleted),
  (ConsultationOutcome.clientNoShow, l10n.outcomeClientNoShow),
  (ConsultationOutcome.clientCancelled, l10n.outcomeClientCancelled),
  (ConsultationOutcome.techIssue, l10n.outcomeTechIssue),
];

/// Показывает шторку и, если эксперт выбрал исход, вызывает
/// `completeConsultation`. Возвращает обновлённую консультацию при успехе,
/// `null` — если эксперт закрыл шторку без выбора ИЛИ запрос не удался
/// (текст ошибки показывается прямо в шторке, повторный выбор доступен
/// сразу — закрывать шторку на ошибке значило бы терять контекст).
Future<ConsultationExpertDto?> showOutcomeSheet(
  BuildContext context, {
  required String consultationId,
}) {
  return showModalBottomSheet<ConsultationExpertDto?>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _OutcomeSheetContent(consultationId: consultationId),
  );
}

class _OutcomeSheetContent extends ConsumerStatefulWidget {
  const _OutcomeSheetContent({required this.consultationId});

  final String consultationId;

  @override
  ConsumerState<_OutcomeSheetContent> createState() =>
      _OutcomeSheetContentState();
}

class _OutcomeSheetContentState extends ConsumerState<_OutcomeSheetContent> {
  bool _busy = false;
  String? _error;

  Future<void> _choose(ConsultationOutcome outcome) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(expertConsultationsRepositoryProvider)
          .complete(widget.consultationId, outcome);
      if (mounted) Navigator.of(context).pop(result);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.outcomeSheetTitle, style: SqTypography.title),
            const SizedBox(height: 16),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _error!,
                  style: SqTypography.body.copyWith(color: SqColors.danger),
                ),
              ),
            for (final (outcome, label) in _outcomes(l10n))
              ListTile(
                key: Key('sq-outcome-${outcome.wireValue}'),
                title: Text(label),
                enabled: !_busy,
                onTap: () => _choose(outcome),
              ),
          ],
        ),
      ),
    );
  }
}
