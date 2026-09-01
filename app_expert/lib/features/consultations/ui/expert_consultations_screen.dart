/// Главный список эксперта (E7 задача 12): три вкладки — «Заявки»,
/// «Идёт сейчас»/«Плановые», «История».
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../../offers/ui/offers_list_screen.dart';
import '../state/expert_consultations_controller.dart';
import 'expert_consultation_card.dart';

class ExpertConsultationsScreen extends ConsumerWidget {
  const ExpertConsultationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final state = ref.watch(expertConsultationsControllerProvider);
    final controller = ref.read(expertConsultationsControllerProvider.notifier);

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: SqColors.background,
        appBar: AppBar(
          title: Text(l10n.consultationsScreenTitle),
          bottom: TabBar(
            tabs: [
              Tab(text: l10n.consultationsTabOffers),
              Tab(text: l10n.consultationsTabActive),
              Tab(text: l10n.consultationsTabHistory),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            OffersListScreen(
              offers: state.offers,
              onRefresh: controller.refreshOffers,
            ),
            _ConsultationsList(
              value: state.active,
              onRefresh: controller.refreshActive,
            ),
            _ConsultationsList(
              value: state.history,
              onRefresh: controller.refreshHistory,
            ),
          ],
        ),
      ),
    );
  }
}

class _ConsultationsList extends StatelessWidget {
  const _ConsultationsList({required this.value, required this.onRefresh});

  final AsyncValue<List<ConsultationExpertDto>> value;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return value.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text(
          error is ApiException ? error.message : l10n.errorLoadFailed,
          style: SqTypography.body.copyWith(color: SqColors.danger),
        ),
      ),
      data: (list) {
        if (list.isEmpty) {
          return Center(child: Text(l10n.listEmpty, style: SqTypography.body));
        }
        return RefreshIndicator(
          onRefresh: onRefresh,
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) =>
                ExpertConsultationCard(consultation: list[index]),
          ),
        );
      },
    );
  }
}
