/// Сетка слотов выбранного дня во времени Алматы (E6b).
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../state/slots_controller.dart';

class SlotGrid extends StatelessWidget {
  const SlotGrid({
    super.key,
    required this.slots,
    required this.busy,
    required this.emptyLabel,
    required this.onTap,
  });

  final List<Slot> slots;
  final bool busy;
  final String emptyLabel;
  final ValueChanged<Slot> onTap;

  static String label(Slot slot) {
    final local = almatyTime(slot.startAt);
    return '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (slots.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(SqSpacing.l),
          child: Text(
            emptyLabel,
            style: SqTypography.body.copyWith(color: SqColors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return GridView.count(
      padding: const EdgeInsets.all(SqSpacing.l),
      crossAxisCount: 3,
      childAspectRatio: 2.4,
      mainAxisSpacing: SqSpacing.xs,
      crossAxisSpacing: SqSpacing.xs,
      children: [
        for (final slot in slots)
          GestureDetector(
            key: Key('sq-booking-slot-${slot.startAt.toIso8601String()}'),
            onTap: busy ? null : () => onTap(slot),
            child: Container(
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: SqColors.chipBg,
                borderRadius: BorderRadius.circular(SqRadius.m),
              ),
              child: Text(label(slot), style: SqTypography.title),
            ),
          ),
      ],
    );
  }
}
