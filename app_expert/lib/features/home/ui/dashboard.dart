/// Дашборд кабинета эксперта.
///
/// По прототипу `Expert Web - Главная`: приветствие по имени, строка
/// «сегодня у вас N консультаций», четыре плитки и ближайшая
/// консультация. Прототип показывает ещё график за 7 дней — он ждёт
/// эндпоинта истории по дням, сейчас такого нет, и рисовать график по
/// выдуманным числам хуже, чем не рисовать вовсе.
///
/// Все цифры считаются из уже загруженного списка консультаций: ради
/// дашборда не заводится ни одного нового запроса.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

/// Доля эксперта — 85 % (Р-02). Здесь она нужна, чтобы «доход сегодня»
/// показывал то, что человек получит, а не то, что заплатил клиент.
const double _expertShare = 0.85;

class Dashboard extends StatelessWidget {
  const Dashboard({
    super.key,
    required this.expertName,
    required this.consultations,
    this.ratingAvg,
    required this.now,
    this.onOpenNext,
  });

  final String expertName;
  final List<ConsultationExpertDto> consultations;

  /// Рейтинг приходит из своей выдачи и может быть ещё не загружен —
  /// плитка тогда показывает прочерк, а не выдуманный ноль: «0.0» на
  /// дашборде психолога читается как катастрофа.
  final double? ratingAvg;
  final DateTime now;
  final ValueChanged<String>? onOpenNext;

  bool _isToday(DateTime moment) =>
      moment.year == now.year &&
      moment.month == now.month &&
      moment.day == now.day;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    final today = consultations.where((c) => _isToday(c.startedAt)).toList();
    final completed = today
        .where((c) => c.status == ConsultationStatus.completed)
        .toList();
    final earnedTiyn = completed.fold<int>(
      0,
      (sum, c) => sum + (c.priceTiyn * _expertShare).round(),
    );

    final upcoming = today.where((c) => c.startedAt.isAfter(now)).toList()
      ..sort((a, b) => a.startedAt.compareTo(b.startedAt));
    final next = upcoming.isEmpty ? null : upcoming.first;

    return ListView(
      padding: const EdgeInsets.all(SqSpacing.l),
      children: [
        Text(l10n.dashboardGreeting(expertName), style: SqTypography.h1),
        const SizedBox(height: SqSpacing.xs),
        Text(
          l10n.dashboardTodayCount(today.length),
          style: SqTypography.body.copyWith(color: SqColors.textSecondary),
        ),
        const SizedBox(height: SqSpacing.l),
        _StatRow(
          stats: [
            _Stat('today', l10n.dashboardStatToday, '${today.length}'),
            _Stat(
              'completed',
              l10n.dashboardStatCompleted,
              '${completed.length}',
            ),
            _Stat('earned', l10n.dashboardStatEarned, formatTenge(earnedTiyn)),
            _Stat(
              'rating',
              l10n.dashboardStatRating,
              ratingAvg == null ? '—' : ratingAvg!.toStringAsFixed(1),
            ),
          ],
        ),
        const SizedBox(height: SqSpacing.l),
        if (next != null)
          SqCard(
            key: const Key('sq-dashboard-next'),
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.m),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.dashboardNextTitle, style: SqTypography.title),
                  const SizedBox(height: SqSpacing.xs),
                  Text(
                    '${_time(next.startedAt)} · '
                    '${l10n.clientCode(next.clientCode)}',
                    style: SqTypography.body,
                  ),
                  const SizedBox(height: SqSpacing.m),
                  SqButton(
                    key: const Key('sq-dashboard-open-next'),
                    label: l10n.dashboardOpenConsultation,
                    onPressed: onOpenNext == null
                        ? null
                        : () => onOpenNext!(next.id),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  static String _time(DateTime moment) {
    final local = moment.toLocal();
    return '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }
}

class _Stat {
  const _Stat(this.id, this.label, this.value);

  final String id;
  final String label;
  final String value;
}

/// Четыре плитки в ряд, как в прототипе (`repeat(4, 1fr)`). На узком
/// экране — в две колонки: четыре в ряд на телефоне превращаются в
/// нечитаемые полоски.
class _StatRow extends StatelessWidget {
  const _StatRow({required this.stats});

  final List<_Stat> stats;

  @override
  Widget build(BuildContext context) {
    final columns = SqLayoutScope.of(context).isWide ? 4 : 2;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width =
            (constraints.maxWidth - SqSpacing.m * (columns - 1)) / columns;
        return Wrap(
          spacing: SqSpacing.m,
          runSpacing: SqSpacing.m,
          children: [
            for (final stat in stats)
              SizedBox(
                width: width,
                child: SqCard(
                  key: Key('sq-stat-${stat.id}'),
                  child: Padding(
                    padding: const EdgeInsets.all(SqSpacing.m),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          stat.label,
                          style: SqTypography.caption.copyWith(
                            color: SqColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: SqSpacing.xs),
                        Text(stat.value, style: SqTypography.h2),
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
