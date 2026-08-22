/// Главный экран (прототип `docs/Прототип/assets/screens/07-home.png`):
/// экстренная кнопка, баннер активной консультации (если есть), сетка тем
/// (Р-14), дисклеймер экстренных служб.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../../notifications/state/notifications_controller.dart';
import '../state/home_controller.dart';
import 'active_consultation_banner.dart';
import 'emergency_situation_notice.dart';
import 'topic_grid.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final asyncState = ref.watch(homeControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        title: Text(l10n.homeGreeting),
        actions: [
          IconButton(
            key: const Key('sq-home-notifications-button'),
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_none),
                // Бейдж — дополнение, а не содержимое экрана: пока центр
                // уведомлений не загрузился (или недоступен), счётчик
                // равен нулю и бейджа просто нет.
                if (ref.watch(unreadCountProvider) > 0)
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      key: const Key('sq-home-notifications-badge'),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 5,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: SqColors.danger,
                        borderRadius: BorderRadius.circular(SqRadius.pill),
                      ),
                      child: Text(
                        '${ref.watch(unreadCountProvider)}',
                        style: SqTypography.caption.copyWith(
                          color: SqColors.surface,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            onPressed: () => context.push(RoutePaths.notifications),
          ),
        ],
      ),
      body: SafeArea(
        child: asyncState.when(
          data: (state) => _HomeContent(state: state),
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () =>
                    ref.read(homeControllerProvider.notifier).retry(),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeContent extends StatelessWidget {
  const _HomeContent({required this.state});

  final HomeState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return ListView(
      padding: const EdgeInsets.all(SqSpacing.l),
      children: [
        SqButton(
          key: const Key('sq-home-emergency-button'),
          kind: SqButtonKind.danger,
          label: l10n.homeEmergencyCta,
          onPressed: () => context.push(RoutePaths.emergency),
        ),
        const SizedBox(height: SqSpacing.xs),
        Text(
          l10n.homeEmergencyCtaSubtitle,
          textAlign: TextAlign.center,
          style: SqTypography.caption.copyWith(color: SqColors.textSecondary),
        ),
        if (state.active != null) ...[
          const SizedBox(height: SqSpacing.l),
          ActiveConsultationBanner(
            consultation: state.active!,
            onTap: () => context.push(RoutePaths.session(state.active!.id)),
          ),
        ],
        const SizedBox(height: SqSpacing.l),
        Text(l10n.homeTopicsTitle, style: SqTypography.h2),
        const SizedBox(height: SqSpacing.xs),
        Text(
          l10n.homeTopicsSubtitle,
          style: SqTypography.body.copyWith(color: SqColors.textSecondary),
        ),
        const SizedBox(height: SqSpacing.m),
        TopicGrid(
          topics: state.topics,
          onTopicTap: (topic) => context.push(
            Uri(
              path: RoutePaths.topic,
              queryParameters: {'slug': topic.slug},
            ).toString(),
            // Название темы едет с собой: экран темы показывает его сразу,
            // не перезапрашивая справочник ради одной строки.
            extra: topic,
          ),
        ),
        const SizedBox(height: SqSpacing.l),
        const EmergencySituationNotice(),
        const SizedBox(height: SqSpacing.l),
        SqEmergencyDisclaimer(disclaimerText: l10n.emergencyDisclaimerText),
      ],
    );
  }
}
