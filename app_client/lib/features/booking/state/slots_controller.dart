/// Свободные слоты специалиста на горизонт записи (E6b).
///
/// Время везде считается по Алматы — единая зона MVP (ТЗ §4.4). Бэкенд
/// отдаёт слоты в UTC, поэтому перевод живёт здесь, в одном месте.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/providers.dart';
import '../data/booking_repository.dart';

/// Горизонт записи — столько же, сколько принимает бэкенд.
const int bookingHorizonDays = 14;

/// UTC+5 круглый год: переход на летнее время в Казахстане отменён.
const Duration almatyOffset = Duration(hours: 5);

/// Календарный день по Алматы, к которому относится момент [moment].
DateTime almatyDay(DateTime moment) {
  final local = moment.toUtc().add(almatyOffset);
  return DateTime.utc(local.year, local.month, local.day);
}

/// Час и минута по Алматы — для подписи слота на экране.
DateTime almatyTime(DateTime moment) => moment.toUtc().add(almatyOffset);

class SlotsState {
  const SlotsState({required this.days, required this.byDay});

  /// Дни горизонта по порядку, начиная с сегодняшнего (по Алматы).
  final List<DateTime> days;

  final Map<DateTime, List<Slot>> byDay;

  List<Slot> slotsOn(DateTime day) => byDay[almatyDay(day)] ?? const [];

  bool hasSlotsOn(DateTime day) => slotsOn(day).isNotEmpty;
}

/// Весь горизонт загружается одним запросом: 14 дней слотов — это десятки
/// строк, а по запросу на день экран мигал бы при каждом переключении.
class SlotsController extends AutoDisposeFamilyAsyncNotifier<SlotsState, String> {
  @override
  Future<SlotsState> build(String arg) async {
    final now = ref.watch(nowProvider)();
    final from = now.toUtc();
    final to = from.add(const Duration(days: bookingHorizonDays));

    final slots = await ref
        .read(bookingRepositoryProvider)
        .slots(arg, from: from, to: to);

    final byDay = <DateTime, List<Slot>>{};
    for (final slot in slots) {
      byDay.putIfAbsent(almatyDay(slot.startAt), () => []).add(slot);
    }
    for (final list in byDay.values) {
      list.sort((a, b) => a.startAt.compareTo(b.startAt));
    }

    final first = almatyDay(now);
    final days = [
      for (var i = 0; i < bookingHorizonDays; i++)
        DateTime.utc(first.year, first.month, first.day + i),
    ];
    return SlotsState(days: days, byDay: byDay);
  }
}

final slotsControllerProvider = AsyncNotifierProvider.autoDispose
    .family<SlotsController, SlotsState, String>(SlotsController.new);
