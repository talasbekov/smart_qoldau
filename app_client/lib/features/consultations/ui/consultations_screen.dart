/// Раздел консультаций: активные и история (прототипы `21-consultations.png`,
/// `22-history.png`).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../../funnel/state/search_controller.dart';
import '../../funnel/ui/format_sheet.dart';
import '../../funnel/ui/topic_picker_sheet.dart';
import '../../funnel/data/requests_repository.dart';
import '../../payment/ui/payment_sheet.dart';
import '../state/consultations_controller.dart';
import 'cancel_dialog.dart';
import 'consultation_card.dart';

class ConsultationsScreen extends ConsumerStatefulWidget {
  const ConsultationsScreen({super.key});

  @override
  ConsumerState<ConsultationsScreen> createState() =>
      _ConsultationsScreenState();
}

class _ConsultationsScreenState extends ConsumerState<ConsultationsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  String? _error;

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        title: Text(l10n.navConsultations),
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(text: l10n.consultationsActiveTab),
            Tab(text: l10n.consultationsHistoryTab),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.all(SqSpacing.m),
                child: Text(
                  _error!,
                  key: const Key('sq-consultations-error'),
                  style: SqTypography.body.copyWith(color: SqColors.danger),
                  textAlign: TextAlign.center,
                ),
              ),
            Expanded(
              child: TabBarView(
                controller: _tabs,
                children: [
                  _ConsultationsList(
                    tab: ConsultationsTab.active,
                    onError: (message) => setState(() => _error = message),
                  ),
                  _ConsultationsList(
                    tab: ConsultationsTab.history,
                    onError: (message) => setState(() => _error = message),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConsultationsList extends ConsumerWidget {
  const _ConsultationsList({required this.tab, required this.onError});

  final ConsultationsTab tab;
  final ValueChanged<String> onError;

  Future<void> _cancel(
    BuildContext context,
    WidgetRef ref,
    ClientConsultation consultation,
  ) async {
    if (!await confirmCancelConsultation(context)) return;
    if (!context.mounted) return;
    try {
      await ref
          .read(consultationsControllerProvider(tab).notifier)
          .cancel(consultation.id);
    } on ApiException catch (error) {
      if (context.mounted) onError(errorText(context, error));
    }
  }

  Future<void> _pay(
    BuildContext context,
    WidgetRef ref,
    ClientConsultation consultation,
  ) async {
    final paid = await showPaymentSheet(context, consultation);
    if (paid != true) return;
    await ref.read(consultationsControllerProvider(tab).notifier).refresh();
  }

  /// «Повторить запись»: адресная заявка к тому же специалисту. Тема
  /// спрашивается — её нет в `ConsultationClientDto` (см. задачу 15).
  Future<void> _repeat(
    BuildContext context,
    WidgetRef ref,
    ClientConsultation consultation,
  ) async {
    final topic = await showTopicPickerSheet(context);
    if (topic == null || !context.mounted) return;
    final format = await showFormatSheet(context);
    if (format == null || !context.mounted) return;

    try {
      final request = await ref
          .read(requestsRepositoryProvider)
          .create(
            topicSlug: topic.slug,
            format: format,
            expertId: consultation.expert.id,
          );
      if (!context.mounted) return;
      context.go(
        RoutePaths.search(request.id),
        extra: SearchArgs(
          requestId: request.id,
          topicSlug: topic.slug,
          format: format,
        ),
      );
    } on ApiException catch (error) {
      if (context.mounted) onError(errorText(context, error));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final provider = consultationsControllerProvider(tab);
    final consultations = ref.watch(provider);

    return consultations.when(
      loading: () => const Center(child: SqLoader()),
      error: (error, stackTrace) => Center(
        child: Padding(
          padding: const EdgeInsets.all(SqSpacing.l),
          child: SqErrorView(
            text: error is ApiException
                ? errorText(context, error)
                : l10n.errorGeneric,
            onRetry: () => ref.read(provider.notifier).refresh(),
            retryLabel: l10n.actionRetry,
          ),
        ),
      ),
      data: (list) => list.isEmpty
          ? Center(
              child: SqEmptyState(
                icon: Icons.event_note_outlined,
                title: tab == ConsultationsTab.active
                    ? l10n.consultationsEmptyActive
                    : l10n.consultationsEmptyHistory,
              ),
            )
          : RefreshIndicator(
              onRefresh: () => ref.read(provider.notifier).refresh(),
              child: ListView(
                padding: const EdgeInsets.all(SqSpacing.l),
                children: [
                  for (final consultation in list)
                    ConsultationCard(
                      consultation: consultation,
                      onTap: () => context.push(
                        RoutePaths.consultationDetails(consultation.id),
                      ),
                      onContinue: consultation.status ==
                              ConsultationStatus.active
                          ? () => context.push(
                              RoutePaths.session(consultation.id),
                            )
                          : null,
                      onCancel:
                          consultation.status == ConsultationStatus.active
                          ? () => _cancel(context, ref, consultation)
                          : null,
                      onPay: consultation.paymentStatus ==
                                  ConsultationPaymentStatus.unpaid &&
                              consultation.status == ConsultationStatus.active
                          ? () => _pay(context, ref, consultation)
                          : null,
                      onRepeat:
                          consultation.status == ConsultationStatus.completed
                          ? () => _repeat(context, ref, consultation)
                          : null,
                    ),
                  Center(
                    child: TextButton(
                      key: Key('sq-consultations-load-more-${tab.name}'),
                      onPressed: () => ref.read(provider.notifier).loadMore(),
                      child: Text(l10n.consultationLoadMore),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
