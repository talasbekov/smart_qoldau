/// Строка одного дня недели в `ScheduleScreen` (E7 задача 8): тумблер
/// «работает/выходной» + выбор рабочих часов и перерыва. Пока `enabled`
/// == `false`, выбор времени не отрисовывается вовсе — не просто скрыт
/// визуально, а отсутствует в дереве, поэтому `find.byKey` в тестах
/// однозначно отражает видимое состояние.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

const _dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/// Короткая подпись дня недели по `weekday` (0 = пн, 6 = вс).
String dayLabel(int weekday) => _dayNames[weekday];

/// `"09:00"` для минут от полуночи, `"—"` если время не задано.
String formatMinutes(int? minutes) {
  if (minutes == null) return '—';
  final h = (minutes ~/ 60).toString().padLeft(2, '0');
  final m = (minutes % 60).toString().padLeft(2, '0');
  return '$h:$m';
}

class DayRow extends StatelessWidget {
  const DayRow({
    super.key,
    required this.day,
    required this.onToggle,
    required this.onPickStart,
    required this.onPickEnd,
    required this.onPickBreakStart,
    required this.onPickBreakEnd,
    required this.onClearBreak,
  });

  final ScheduleDay day;
  final VoidCallback onToggle;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;
  final VoidCallback onPickBreakStart;
  final VoidCallback onPickBreakEnd;
  final VoidCallback onClearBreak;

  @override
  Widget build(BuildContext context) {
    return SqCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(dayLabel(day.weekday), style: SqTypography.title),
              ),
              Switch(
                key: Key('day-${day.weekday}-toggle'),
                value: day.enabled,
                onChanged: (_) => onToggle(),
              ),
            ],
          ),
          if (day.enabled) ...[
            const SizedBox(height: SqSpacing.s),
            Row(
              children: [
                Expanded(
                  child: _TimeField(
                    fieldKey: Key('day-${day.weekday}-start'),
                    label: 'Начало',
                    minutes: day.startMin,
                    onTap: onPickStart,
                  ),
                ),
                const SizedBox(width: SqSpacing.s),
                Expanded(
                  child: _TimeField(
                    fieldKey: Key('day-${day.weekday}-end'),
                    label: 'Конец',
                    minutes: day.endMin,
                    onTap: onPickEnd,
                  ),
                ),
              ],
            ),
            const SizedBox(height: SqSpacing.s),
            Row(
              children: [
                Expanded(
                  child: _TimeField(
                    fieldKey: Key('day-${day.weekday}-break-start'),
                    label: 'Перерыв с',
                    minutes: day.breakStart,
                    onTap: onPickBreakStart,
                  ),
                ),
                const SizedBox(width: SqSpacing.s),
                Expanded(
                  child: _TimeField(
                    fieldKey: Key('day-${day.weekday}-break-end'),
                    label: 'Перерыв до',
                    minutes: day.breakEnd,
                    onTap: onPickBreakEnd,
                  ),
                ),
              ],
            ),
            if (day.breakStart != null || day.breakEnd != null) ...[
              const SizedBox(height: SqSpacing.xs),
              GestureDetector(
                key: Key('day-${day.weekday}-clear-break'),
                onTap: onClearBreak,
                child: Text(
                  'Убрать перерыв',
                  style: SqTypography.caption.copyWith(
                    color: SqColors.textSecondary,
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _TimeField extends StatelessWidget {
  const _TimeField({
    required this.fieldKey,
    required this.label,
    required this.minutes,
    required this.onTap,
  });

  final Key fieldKey;
  final String label;
  final int? minutes;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      key: fieldKey,
      onTap: onTap,
      borderRadius: BorderRadius.circular(SqRadius.s),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: SqSpacing.s,
          vertical: SqSpacing.s,
        ),
        decoration: BoxDecoration(
          border: Border.all(color: SqColors.border),
          borderRadius: BorderRadius.circular(SqRadius.s),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: SqTypography.caption.copyWith(
                color: SqColors.textTertiary,
              ),
            ),
            Text(formatMinutes(minutes), style: SqTypography.body),
          ],
        ),
      ),
    );
  }
}
