/// Горизонтальная лента дней горизонта записи (E6b).
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

class DayStrip extends StatelessWidget {
  const DayStrip({
    super.key,
    required this.days,
    required this.selected,
    required this.hasSlots,
    required this.onSelect,
  });

  final List<DateTime> days;
  final DateTime selected;

  /// День, в котором свободного времени нет, помечается сразу — иначе
  /// пользователь перебирает пустые дни вручную.
  final bool Function(DateTime day) hasSlots;

  final ValueChanged<DateTime> onSelect;

  static const _weekdays = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: SqSpacing.l),
        itemCount: days.length,
        separatorBuilder: (_, _) => const SizedBox(width: SqSpacing.xs),
        itemBuilder: (context, index) {
          final day = days[index];
          final isSelected = day == selected;
          final free = hasSlots(day);
          return GestureDetector(
            key: Key(
              'sq-booking-day-${day.toIso8601String().split('T').first}',
            ),
            onTap: () => onSelect(day),
            child: Container(
              width: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isSelected ? SqColors.primary : SqColors.chipBg,
                borderRadius: BorderRadius.circular(SqRadius.m),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _weekdays[day.weekday - 1],
                    style: SqTypography.caption.copyWith(
                      color: isSelected ? Colors.white : SqColors.textSecondary,
                    ),
                  ),
                  Text(
                    '${day.day}',
                    style: SqTypography.title.copyWith(
                      color: isSelected ? Colors.white : SqColors.textPrimary,
                    ),
                  ),
                  if (!free)
                    Container(
                      width: 4,
                      height: 4,
                      decoration: const BoxDecoration(
                        color: SqColors.textTertiary,
                        shape: BoxShape.circle,
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
