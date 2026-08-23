/// Экран выбора времени: лента дней и сетка слотов (E6b).
///
/// Всё время показывается по Алматы и это сказано на экране прямым текстом:
/// клиент из другого пояса иначе ошибётся на несколько часов.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/booking_controller.dart';
import '../state/slots_controller.dart';
import 'card_picker_sheet.dart';
import 'day_strip.dart';
import 'slot_grid.dart';

class SlotPickerScreen extends ConsumerStatefulWidget {
  const SlotPickerScreen({
    super.key,
    required this.expertId,
    required this.topicSlug,
    required this.format,
    this.consultationId,
  });

  final String expertId;
  final String topicSlug;
  final SessionFormat format;

  /// Задан — экран работает как перенос: холд уже стоит, карта не нужна.
  final String? consultationId;

  bool get isReschedule => consultationId != null;

  @override
  ConsumerState<SlotPickerScreen> createState() => _SlotPickerScreenState();
}

class _SlotPickerScreenState extends ConsumerState<SlotPickerScreen> {
  DateTime? _selectedDay;
  String? _errorCode;

  Future<void> _pick(Slot slot) async {
    final l10n = AppLocalizations.of(context)!;
    final notifier = ref.read(bookingControllerProvider.notifier);

    bool ok;
    if (widget.isReschedule) {
      ok = await notifier.reschedule(
        consultationId: widget.consultationId!,
        slotStartAt: slot.startAt,
      );
    } else {
      final cardId = await showCardPickerSheet(context, l10n.bookingConfirm);
      if (cardId == null || !mounted) return;
      ok = await notifier.book(
        expertId: widget.expertId,
        topicSlug: widget.topicSlug,
        format: widget.format,
        slotStartAt: slot.startAt,
        paymentMethodId: cardId,
      );
    }
    if (!mounted) return;

    if (ok) {
      context.go(RoutePaths.consultations);
      return;
    }

    final code = ref.read(bookingControllerProvider).errorCode;
    setState(() => _errorCode = code);
    // Слот заняли или клиентские часы разошлись с серверными — выдача
    // устарела, перечитываем её целиком.
    if (code == 'SLOT_TAKEN' || code == 'SLOT_OUT_OF_RANGE') {
      ref.invalidate(slotsControllerProvider(widget.expertId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final slots = ref.watch(slotsControllerProvider(widget.expertId));
    final booking = ref.watch(bookingControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        title: Text(
          widget.isReschedule ? l10n.rescheduleTitle : l10n.bookingTitle,
        ),
      ),
      body: SafeArea(
        child: slots.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () =>
                    ref.invalidate(slotsControllerProvider(widget.expertId)),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (state) {
            final day = _selectedDay ?? state.days.first;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DayStrip(
                  days: state.days,
                  selected: day,
                  hasSlots: state.hasSlotsOn,
                  onSelect: (value) => setState(() {
                    _selectedDay = value;
                    _errorCode = null;
                  }),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: SqSpacing.l,
                    vertical: SqSpacing.xs,
                  ),
                  child: Text(
                    l10n.bookingTimezoneNote,
                    style: SqTypography.caption.copyWith(
                      color: SqColors.textSecondary,
                    ),
                  ),
                ),
                if (_errorCode != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: SqSpacing.l,
                      vertical: SqSpacing.xs,
                    ),
                    child: Text(
                      _errorCode == 'SLOT_TAKEN'
                          ? l10n.bookingSlotTaken
                          : errorText(
                              context,
                              ApiException(_errorCode!, '', 0),
                            ),
                      key: const Key('sq-booking-error'),
                      style: SqTypography.body.copyWith(color: SqColors.danger),
                    ),
                  ),
                Expanded(
                  child: SlotGrid(
                    slots: state.slotsOn(day),
                    busy: booking.busy,
                    emptyLabel: l10n.bookingNoSlotsDay,
                    onTap: _pick,
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
