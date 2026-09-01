/// Экран «специалист найден» (прототип `10-found.png`): карточка
/// подобранного специалиста, переход к оплате и отказ от консультации.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/found_controller.dart';
import 'payment_sheet.dart';

/// Локализованный уровень опыта специалиста.
String experienceLabel(AppLocalizations l10n, ExperienceLevel level) =>
    switch (level) {
      ExperienceLevel.lessThanYear => l10n.experienceLessThanYear,
      ExperienceLevel.oneToThree => l10n.experienceOneToThree,
      ExperienceLevel.threeToFive => l10n.experienceThreeToFive,
      ExperienceLevel.fiveToTen => l10n.experienceFiveToTen,
      ExperienceLevel.moreThanTen => l10n.experienceMoreThanTen,
    };

class FoundScreen extends ConsumerStatefulWidget {
  const FoundScreen({super.key, required this.requestId});

  final String requestId;

  @override
  ConsumerState<FoundScreen> createState() => _FoundScreenState();
}

class _FoundScreenState extends ConsumerState<FoundScreen> {
  bool _cancelling = false;
  String? _error;

  Future<void> _startConsultation(ClientConsultation consultation) async {
    final paid = await showPaymentSheet(context, consultation);
    if (paid != true || !mounted) return;
    context.go(RoutePaths.session(consultation.id));
  }

  Future<void> _cancel() async {
    setState(() {
      _cancelling = true;
      _error = null;
    });
    try {
      await ref
          .read(foundControllerProvider(widget.requestId).notifier)
          .cancelConsultation();
      if (!mounted) return;
      context.go(RoutePaths.home);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = errorText(context, error));
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizations.of(context)!.errorGeneric);
      }
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final provider = foundControllerProvider(widget.requestId);
    final asyncState = ref.watch(provider);

    return Scaffold(
      backgroundColor: SqColors.background,
      body: SafeArea(
        child: asyncState.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () => ref.read(provider.notifier).retry(),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (state) => ListView(
            padding: const EdgeInsets.all(SqSpacing.l),
            children: [
              const SizedBox(height: SqSpacing.xl),
              const Center(
                child: Icon(
                  Icons.check_circle,
                  size: 72,
                  color: SqColors.primary,
                ),
              ),
              const SizedBox(height: SqSpacing.l),
              Text(
                l10n.foundTitle,
                style: SqTypography.h1,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: SqSpacing.l),
              _ExpertCard(
                expert: state.expert,
                priceTiyn: state.consultation.priceTiyn,
              ),
              if (_error != null) ...[
                const SizedBox(height: SqSpacing.m),
                Text(
                  _error!,
                  key: const Key('sq-found-error'),
                  style: SqTypography.body.copyWith(color: SqColors.danger),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: SqSpacing.xl),
              SqButton(
                key: const Key('sq-found-start'),
                label: l10n.foundStart,
                onPressed: _cancelling
                    ? null
                    : () => _startConsultation(state.consultation),
              ),
              const SizedBox(height: SqSpacing.m),
              SqButton(
                key: const Key('sq-found-cancel'),
                kind: SqButtonKind.ghost,
                label: l10n.foundCancel,
                loading: _cancelling,
                onPressed: _cancelling ? null : _cancel,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ExpertCard extends StatelessWidget {
  const _ExpertCard({required this.expert, required this.priceTiyn});

  final ExpertPublic expert;
  final int priceTiyn;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return SqCard(
      child: Column(
        children: [
          SqAvatar(name: expert.displayName, size: 72),
          const SizedBox(height: SqSpacing.m),
          Text(expert.displayName, style: SqTypography.h2),
          const SizedBox(height: SqSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.circle, size: 10, color: SqColors.accent),
              const SizedBox(width: SqSpacing.s),
              Text(
                l10n.foundOnline,
                style: SqTypography.body.copyWith(color: SqColors.accent),
              ),
            ],
          ),
          const SizedBox(height: SqSpacing.s),
          Text(
            '${expert.city} · ${l10n.expertExperienceLabel}: '
            '${experienceLabel(l10n, expert.experience)}',
            style: SqTypography.body.copyWith(color: SqColors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: SqSpacing.xs),
          Text(
            l10n.expertLanguages(
              expert.languages.map((e) => e.toUpperCase()).join(' · '),
            ),
            style: SqTypography.caption.copyWith(color: SqColors.textSecondary),
          ),
          const SizedBox(height: SqSpacing.m),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SqRatingStars(value: expert.ratingAvg),
              const SizedBox(width: SqSpacing.s),
              Text(
                expert.ratingAvg.toStringAsFixed(1),
                style: SqTypography.title,
              ),
              const SizedBox(width: SqSpacing.s),
              Text(
                l10n.expertReviewsCount(expert.ratingCount),
                style: SqTypography.caption.copyWith(
                  color: SqColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: SqSpacing.m),
          Text(formatTenge(priceTiyn), style: SqTypography.h2),
        ],
      ),
    );
  }
}
