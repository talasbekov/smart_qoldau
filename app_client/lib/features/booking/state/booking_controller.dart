/// Запись на слот и перенос (E6b).
library;

import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/booking_repository.dart';

enum BookingPhase { idle, sending, done }

class BookingState {
  const BookingState({
    this.phase = BookingPhase.idle,
    this.errorCode,
    this.result,
  });

  final BookingPhase phase;

  /// Код ошибки бэкенда; `SLOT_TAKEN` экран показывает отдельным текстом и
  /// перезагружает слоты — выдача устарела.
  final String? errorCode;

  final BookingResult? result;

  bool get busy => phase == BookingPhase.sending;
}

class BookingController extends AutoDisposeNotifier<BookingState> {
  @override
  BookingState build() => const BookingState();

  /// Возвращает `true`, если запись создана. Повторный вызов, пока запрос в
  /// полёте, игнорируется: второй тап не должен порождать вторую запись
  /// (бэкенд идемпотентен, но клиент не должен на это опираться).
  Future<bool> book({
    required String expertId,
    required String topicSlug,
    required SessionFormat format,
    required DateTime slotStartAt,
    required String paymentMethodId,
  }) => _run(
    () => ref
        .read(bookingRepositoryProvider)
        .book(
          expertId: expertId,
          topicSlug: topicSlug,
          format: format,
          slotStartAt: slotStartAt,
          paymentMethodId: paymentMethodId,
        ),
  );

  Future<bool> reschedule({
    required String consultationId,
    required DateTime slotStartAt,
  }) => _run(
    () => ref
        .read(bookingRepositoryProvider)
        .reschedule(consultationId, slotStartAt),
  );

  Future<bool> _run(Future<BookingResult> Function() action) async {
    if (state.busy) return false;
    state = const BookingState(phase: BookingPhase.sending);
    try {
      final result = await action();
      state = BookingState(phase: BookingPhase.done, result: result);
      return true;
    } on ApiException catch (error) {
      developer.log('запись не создана: ${error.code}', name: 'BookingController');
      state = BookingState(errorCode: error.code);
      return false;
    } catch (error) {
      developer.log(
        'запись не создана: ${error.runtimeType}',
        name: 'BookingController',
      );
      state = const BookingState(errorCode: 'UNKNOWN');
      return false;
    }
  }
}

final bookingControllerProvider =
    NotifierProvider.autoDispose<BookingController, BookingState>(
      BookingController.new,
    );
