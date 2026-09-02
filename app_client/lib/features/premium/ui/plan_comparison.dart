/// Сравнение тарифов «Базовый» и «Premium».
///
/// Раскладка — из прототипа `SmartQoldau Web - Premium`: две колонки со
/// списками возможностей, у платной подчёркнутая рамка и кнопка.
///
/// Цены и состав берутся НЕ из прототипа. Там 4 990 ₸/мес — устаревшее
/// значение (расхождение №1, закрытое решением Р-08: 4 990 ₸/мес и
/// 39 900 ₸/год, единый список преимуществ). Прототип в этой части
/// требует правки, а не воспроизведения.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

/// Состав тарифов. Списки взяты из прототипа — они не противоречат Р-08 и
/// описывают ровно то, что продукт умеет.
const _basicFeatures = <String>[
  'Подбор специалиста',
  'Чат, аудио и видео',
  'Базовые дыхательные упражнения',
  'Анонимный режим',
];

const _premiumFeatures = <String>[
  'Приоритет при подборе специалиста',
  'Полная библиотека медитаций',
  'Расширенные дыхательные практики',
  'Библиотека статей без ограничений',
  'Скидка на консультации',
];

class PlanComparison extends StatelessWidget {
  const PlanComparison({super.key, this.onSubscribe});

  final VoidCallback? onSubscribe;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final wide = SqLayoutScope.of(context).isWide;

    final basic = _PlanCard(
      key: const Key('sq-plan-basic'),
      title: l10n.premiumStatusInactive,
      price: l10n.premiumPlanFree,
      features: _basicFeatures,
      highlighted: false,
    );
    final premium = _PlanCard(
      key: const Key('sq-plan-premium'),
      title: l10n.premiumTitle,
      // 4 990 ₸ — решение владельца от 2026-09-02. Формат суммы общий
      // для всего продукта. ДОЛГ: цену надо брать из GET /v1/premium/plans,
      // а не хранить здесь копию — см. задачу в Plane.
      price: '${formatTenge(499000)} / ${l10n.premiumPlanMonth.toLowerCase()}',
      features: _premiumFeatures,
      highlighted: true,
      action: onSubscribe,
      actionLabel: l10n.premiumSubscribe,
    );

    if (!wide) {
      return ListView(
        padding: const EdgeInsets.all(SqSpacing.l),
        children: [
          basic,
          const SizedBox(height: SqSpacing.m),
          premium,
        ],
      );
    }

    return Padding(
      padding: const EdgeInsets.all(SqSpacing.l),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: basic),
          const SizedBox(width: SqSpacing.l),
          Expanded(child: premium),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    super.key,
    required this.title,
    required this.price,
    required this.features,
    required this.highlighted,
    this.action,
    this.actionLabel,
  });

  final String title;
  final String price;
  final List<String> features;
  final bool highlighted;
  final VoidCallback? action;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(SqSpacing.l),
      decoration: BoxDecoration(
        color: SqColors.surface,
        borderRadius: BorderRadius.circular(SqRadius.m),
        border: Border.all(
          color: highlighted ? SqColors.primary : SqColors.border,
          width: highlighted ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: SqTypography.title),
          const SizedBox(height: SqSpacing.xs),
          Text(
            price,
            style: SqTypography.h2.copyWith(
              color: highlighted ? SqColors.primary : SqColors.textPrimary,
            ),
          ),
          const SizedBox(height: SqSpacing.m),
          for (final feature in features)
            Padding(
              padding: const EdgeInsets.only(bottom: SqSpacing.xs),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.check, size: 16, color: SqColors.primary),
                  const SizedBox(width: SqSpacing.s),
                  Expanded(child: Text(feature, style: SqTypography.body)),
                ],
              ),
            ),
          if (action != null && actionLabel != null) ...[
            const SizedBox(height: SqSpacing.m),
            SqButton(
              key: const Key('sq-plan-subscribe'),
              label: actionLabel!,
              onPressed: action,
            ),
          ],
        ],
      ),
    );
  }
}
