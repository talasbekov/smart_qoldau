/// Карточка обращения: тема, статус и переписка с поддержкой.
///
/// Дописать в тред клиент не может — бэкенд не даёт автору отвечать в
/// существующее обращение (`TicketsService`: сообщения в тред пишут только
/// сотрудники). Это ограничение показано текстом, а не спрятано отсутствием
/// поля ввода.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../l10n/app_localizations.dart';
import '../state/tickets_controller.dart';
import 'support_screen.dart' show ticketCategoryLabel, ticketStatusLabel;

class TicketScreen extends ConsumerWidget {
  const TicketScreen({super.key, required this.ticketId});

  final String ticketId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final ticket = ref.watch(ticketDetailProvider(ticketId));

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.supportTitle)),
      body: SafeArea(
        child: ticket.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () => ref.invalidate(ticketDetailProvider(ticketId)),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (data) => ListView(
            padding: const EdgeInsets.all(SqSpacing.l),
            children: [
              Text(data.subject, style: SqTypography.h2),
              const SizedBox(height: SqSpacing.s),
              Wrap(
                spacing: SqSpacing.s,
                children: [
                  SqChip(label: ticketCategoryLabel(l10n, data.category)),
                  SqChip(label: ticketStatusLabel(l10n, data.status)),
                ],
              ),
              const SizedBox(height: SqSpacing.l),
              _Message(
                author: l10n.ticketAuthorYou,
                body: data.body,
                isStaff: false,
              ),
              for (final message in data.messages)
                _Message(
                  key: Key('sq-ticket-message-${message.id}'),
                  author: message.authorKind == TicketAuthorKind.staff
                      ? l10n.ticketAuthorStaff
                      : l10n.ticketAuthorYou,
                  body: message.body,
                  isStaff: message.authorKind == TicketAuthorKind.staff,
                ),
              const SizedBox(height: SqSpacing.l),
              Text(
                l10n.supportNoReplyNotice,
                style: SqTypography.caption.copyWith(
                  color: SqColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    super.key,
    required this.author,
    required this.body,
    required this.isStaff,
  });

  final String author;
  final String body;

  /// Сообщения сотрудника и автора различаются и цветом, и подписью —
  /// в переписке о деньгах или безопасности путать их нельзя.
  final bool isStaff;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: SqSpacing.m),
    child: Container(
      padding: const EdgeInsets.all(SqSpacing.m),
      decoration: BoxDecoration(
        color: isStaff ? SqColors.chipBg : SqColors.surface,
        borderRadius: BorderRadius.circular(SqRadius.m),
        border: Border.all(color: SqColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            author,
            style: SqTypography.caption.copyWith(
              color: isStaff ? SqColors.primary : SqColors.textSecondary,
            ),
          ),
          const SizedBox(height: SqSpacing.xs),
          Text(body, style: SqTypography.body),
        ],
      ),
    ),
  );
}
