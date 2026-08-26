/// Плитки дохода по прототипу `Expert Web - Доход`: доход за период,
/// число консультаций, средний чек и комиссия платформы.
///
/// «Доход» здесь — НЕТТО эксперта (Р-02: цена минус 15 %), а не сумма,
/// которую заплатили клиенты. Показывать вторую под словом «доход»
/// значит обещать деньги, которых человек не получит.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class EarningsStats extends StatelessWidget {
  const EarningsStats({super.key, required this.items});

  final List<EarningsItemDto> items;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    final netTotal = items.fold<int>(0, (sum, i) => sum + i.netTiyn);
    final grossTotal = items.fold<int>(0, (sum, i) => sum + i.priceTiyn);
    final average = items.isEmpty ? 0 : (grossTotal / items.length).round();

    final stats = <(String, String, String)>[
      ('total', l10n.earningsStatTotal, formatTenge(netTotal)),
      ('count', l10n.earningsStatCount, '${items.length}'),
      ('average', l10n.earningsStatAverage, formatTenge(average)),
      // Ставка фиксированная (Р-02) и показывается как факт: у эксперта
      // она всегда 15 %, вычислять тут нечего.
      ('commission', l10n.earningsStatCommission, '15%'),
    ];

    final columns = SqLayoutScope.of(context).isWide ? 4 : 2;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width =
            (constraints.maxWidth - SqSpacing.m * (columns - 1)) / columns;
        return Wrap(
          spacing: SqSpacing.m,
          runSpacing: SqSpacing.m,
          children: [
            for (final (id, label, value) in stats)
              SizedBox(
                width: width,
                child: SqCard(
                  key: Key('sq-earnings-stat-$id'),
                  child: Padding(
                    padding: const EdgeInsets.all(SqSpacing.m),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label,
                          style: SqTypography.caption.copyWith(
                            color: SqColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: SqSpacing.xs),
                        Text(value, style: SqTypography.h2),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
