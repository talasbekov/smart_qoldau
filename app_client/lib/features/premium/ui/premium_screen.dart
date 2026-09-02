/// Экран Premium: тарифы Р-08, оформление, статус и отмена подписки.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/premium_controller.dart';

/// Цены Р-08 в тиынах. Дублируют бэкенд намеренно: экран обязан показать
/// сумму ДО запроса, а отдельного справочника тарифов в API нет. Значение
/// одно на всех поверхностях — 4 990 ₸ из старого веб-прототипа устарело.
const _priceByPlan = <PremiumPlan, int>{
  PremiumPlan.month: 499000,
  PremiumPlan.year: 3990000,
};

class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen> {
  PremiumPlan _selected = PremiumPlan.month;
  bool _busy = false;
  String? _error;

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = errorText(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _formatDate(DateTime date) {
    final local = date.toLocal();
    return '${local.day.toString().padLeft(2, '0')}.'
        '${local.month.toString().padLeft(2, '0')}.${local.year}';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final state = ref.watch(premiumControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.premiumTitle)),
      body: SafeArea(
        child: state.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () =>
                    ref.read(premiumControllerProvider.notifier).reload(),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (data) => ListView(
            padding: const EdgeInsets.all(SqSpacing.l),
            children: [
              Text(l10n.premiumPitch, style: SqTypography.body),
              const SizedBox(height: SqSpacing.l),
              if (data.status.active)
                ..._activeSection(context, l10n, data)
              else
                ..._offerSection(context, l10n, data),
              if (_error != null) ...[
                const SizedBox(height: SqSpacing.m),
                Text(
                  _error!,
                  key: const Key('sq-premium-error'),
                  style: SqTypography.body.copyWith(color: SqColors.danger),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _activeSection(
    BuildContext context,
    AppLocalizations l10n,
    PremiumState data,
  ) {
    final until = data.status.currentPeriodEnd;
    final untilText = until == null
        ? l10n.premiumStatusInactive
        : data.status.cancelled
        ? l10n.premiumCancelledUntil(_formatDate(until))
        : l10n.premiumActiveUntil(_formatDate(until));

    return [
      SqCard(
        child: Padding(
          padding: const EdgeInsets.all(SqSpacing.m),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(untilText, style: SqTypography.title),
              if (data.status.inGrace) ...[
                const SizedBox(height: SqSpacing.s),
                Text(l10n.premiumStatusGrace, style: SqTypography.caption),
              ],
            ],
          ),
        ),
      ),
      const SizedBox(height: SqSpacing.l),
      // Отменённой подписке отменять нечего — доступ и так дотикает до
      // конца оплаченного периода (Р-09).
      if (!data.status.cancelled)
        SqButton(
          key: const Key('sq-premium-cancel'),
          label: l10n.premiumCancel,
          kind: SqButtonKind.secondary,
          loading: _busy,
          onPressed: () =>
              _run(() => ref.read(premiumControllerProvider.notifier).cancel()),
        ),
    ];
  }

  List<Widget> _offerSection(
    BuildContext context,
    AppLocalizations l10n,
    PremiumState data,
  ) {
    return [
      _planTile(
        l10n,
        PremiumPlan.month,
        l10n.premiumPlanMonth,
        const Key('sq-premium-plan-month'),
      ),
      const SizedBox(height: SqSpacing.m),
      _planTile(
        l10n,
        PremiumPlan.year,
        l10n.premiumPlanYear,
        const Key('sq-premium-plan-year'),
        hint: l10n.premiumPlanYearHint,
      ),
      const SizedBox(height: SqSpacing.l),
      if (data.hasCard)
        SqButton(
          key: const Key('sq-premium-subscribe'),
          label: l10n.premiumSubscribe,
          loading: _busy,
          onPressed: () => _run(
            () => ref
                .read(premiumControllerProvider.notifier)
                .subscribe(_selected),
          ),
        )
      else ...[
        // Без карты списывать нечем: показывать кнопку «Оформить» значило бы
        // вести человека в отказ вместо подписки.
        Text(l10n.premiumNoCard, style: SqTypography.caption),
        const SizedBox(height: SqSpacing.m),
        SqButton(
          key: const Key('sq-premium-add-card'),
          label: l10n.premiumAddCard,
          onPressed: () => context.push(RoutePaths.cardsAdd),
        ),
      ],
    ];
  }

  Widget _planTile(
    AppLocalizations l10n,
    PremiumPlan plan,
    String title,
    Key key, {
    String? hint,
  }) {
    final selected = _selected == plan;
    final period = plan == PremiumPlan.month
        ? l10n.premiumPlanMonth
        : l10n.premiumPlanYear;

    return InkWell(
      key: key,
      onTap: () => setState(() => _selected = plan),
      child: SqCard(
        child: Padding(
          padding: const EdgeInsets.all(SqSpacing.m),
          child: Row(
            children: [
              Icon(
                selected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
                color: selected ? SqColors.primary : SqColors.textSecondary,
              ),
              const SizedBox(width: SqSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: SqTypography.title),
                    Text(
                      l10n.premiumPlanPrice(
                        formatTenge(_priceByPlan[plan]!),
                        period.toLowerCase(),
                      ),
                      style: SqTypography.body,
                    ),
                    if (hint != null) Text(hint, style: SqTypography.caption),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
