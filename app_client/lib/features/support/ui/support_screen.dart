/// Список обращений клиента в поддержку.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/tickets_controller.dart';

/// Локализованный статус обращения.
String ticketStatusLabel(AppLocalizations l10n, TicketStatus status) =>
    switch (status) {
      TicketStatus.new_ => l10n.ticketStatusNew,
      TicketStatus.inProgress => l10n.ticketStatusInProgress,
      TicketStatus.resolved => l10n.ticketStatusResolved,
    };

/// Локализованная категория обращения.
String ticketCategoryLabel(AppLocalizations l10n, TicketCategory category) =>
    switch (category) {
      TicketCategory.consultations => l10n.ticketCategoryConsultations,
      TicketCategory.payment => l10n.ticketCategoryPayment,
      TicketCategory.technical => l10n.ticketCategoryTechnical,
      TicketCategory.accountData => l10n.ticketCategoryAccountData,
      TicketCategory.security => l10n.ticketCategorySecurity,
      // Экспертные категории клиенту не приходят, но обобщённая подпись
      // лучше падения на неожиданном значении.
      _ => l10n.ticketCategoryOther,
    };

class SupportScreen extends ConsumerWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final tickets = ref.watch(ticketsControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.supportTitle)),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('sq-support-new'),
        onPressed: () => context.push(RoutePaths.supportNew),
        label: Text(l10n.supportNewTicket),
        icon: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: tickets.when(
                loading: () => const Center(child: SqLoader()),
                error: (error, stackTrace) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(SqSpacing.l),
                    child: SqErrorView(
                      text: error is ApiException
                          ? errorText(context, error)
                          : l10n.errorGeneric,
                      onRetry: () =>
                          ref.read(ticketsControllerProvider.notifier).refresh(),
                      retryLabel: l10n.actionRetry,
                    ),
                  ),
                ),
                data: (list) => list.isEmpty
                    ? Center(
                        child: SqEmptyState(
                          icon: Icons.support_agent_outlined,
                          title: l10n.supportEmpty,
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.all(SqSpacing.l),
                        children: [
                          for (final ticket in list)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: SqSpacing.m,
                              ),
                              child: InkWell(
                                key: Key('sq-ticket-${ticket.id}'),
                                onTap: () => context.push(
                                  RoutePaths.supportTicket(ticket.id),
                                ),
                                borderRadius: BorderRadius.circular(
                                  SqRadius.m,
                                ),
                                child: SqCard(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        ticket.subject,
                                        style: SqTypography.title,
                                      ),
                                      const SizedBox(height: SqSpacing.s),
                                      Wrap(
                                        spacing: SqSpacing.s,
                                        children: [
                                          SqChip(
                                            label: ticketCategoryLabel(
                                              l10n,
                                              ticket.category,
                                            ),
                                          ),
                                          SqChip(
                                            label: ticketStatusLabel(
                                              l10n,
                                              ticket.status,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
              ),
            ),
            // ТЗ §4.3: напоминание про экстренные службы должно быть там,
            // где человек ищет помощь.
            Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqEmergencyDisclaimer(
                disclaimerText: l10n.emergencyDisclaimerText,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
