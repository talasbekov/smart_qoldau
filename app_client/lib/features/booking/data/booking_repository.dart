/// Слоты и запись к специалисту (E6b).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/providers.dart';

class BookingRepository {
  const BookingRepository(this._api);

  final SqApi _api;

  Future<List<Slot>> slots(
    String expertId, {
    required DateTime from,
    required DateTime to,
  }) => _api.slots(expertId, from: from, to: to);

  Future<BookingResult> book({
    required String expertId,
    required String topicSlug,
    required SessionFormat format,
    required DateTime slotStartAt,
    required String paymentMethodId,
  }) => _api.createBooking(
    expertId: expertId,
    topicSlug: topicSlug,
    format: format,
    slotStartAt: slotStartAt,
    paymentMethodId: paymentMethodId,
  );

  Future<BookingResult> reschedule(String consultationId, DateTime slotStartAt) =>
      _api.reschedule(consultationId, slotStartAt);
}

final bookingRepositoryProvider = Provider<BookingRepository>(
  (ref) => BookingRepository(ref.watch(sqApiProvider)),
);
