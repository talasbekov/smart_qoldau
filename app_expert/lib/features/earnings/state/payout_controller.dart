/// Заявка на вывод средств (E7 задача 14): валидация на клиенте — только
/// `amountTiyn >= 1` и формат PAN (маска Луна)/`expiry`. Лимиты (10 000 ₸
/// минимум, автоодобрение ≤300 000 ₸/мес) — ответственность бэкенда,
/// контроллер только показывает `PayoutDto.status`/`rejectReason` из ответа.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/earnings_repository.dart';

/// Проверка Луна — та же логика, что
/// `app_client/lib/features/payment/ui/add_card_screen.dart`
/// (`isValidPan`), скопирована сюда намеренно: это UI-валидация
/// конкретного экрана, не транспортный код `shared` (решение 1 плана сюда
/// не распространяется). Бэкенд её не делает (`RequestPayoutDto`: только
/// длина 12–19 и «только цифры»).
bool isValidPan(String digits) {
  if (digits.length < 12 || digits.length > 19) return false;
  var sum = 0;
  var double = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var value = int.parse(digits[i]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 == 0;
}

/// `MM/YY` с реально существующим месяцем — та же проверка, что
/// `add_card_screen.dart`.
bool isValidExpiry(String value) => RegExp(r'^(0[1-9]|1[0-2])/\d{2}$').hasMatch(value);

class PayoutState {
  const PayoutState({
    this.submitting = false,
    this.result,
    this.errorMessage,
    this.validationError,
  });

  final bool submitting;

  /// Заявка, созданная последним успешным `submit()`.
  final PayoutDto? result;

  /// Текст ошибки бэкенда (`ApiException.message`).
  final String? errorMessage;

  /// Текст ошибки клиентской валидации — раньше сети, без круга на сервер.
  final String? validationError;

  PayoutState copyWith({
    bool? submitting,
    PayoutDto? result,
    String? errorMessage,
    String? validationError,
  }) => PayoutState(
    submitting: submitting ?? this.submitting,
    result: result ?? this.result,
    errorMessage: errorMessage,
    validationError: validationError,
  );
}

class PayoutController extends Notifier<PayoutState> {
  @override
  PayoutState build() => const PayoutState();

  /// Возвращает текст клиентской ошибки без сетевого вызова — `null`,
  /// если поля прошли валидацию.
  String? _validate({
    required int amountTiyn,
    required String pan,
    required String expiry,
  }) {
    if (amountTiyn < 1) return 'Сумма должна быть больше нуля';
    final digits = pan.replaceAll(RegExp(r'\D'), '');
    if (!isValidPan(digits)) return 'Неверный номер карты';
    if (!isValidExpiry(expiry)) return 'Неверный срок действия (MM/YY)';
    return null;
  }

  Future<void> submit({
    required int amountTiyn,
    required String pan,
    required String expiry,
    required String holderName,
  }) async {
    if (state.submitting) return;

    final validationError = _validate(amountTiyn: amountTiyn, pan: pan, expiry: expiry);
    if (validationError != null) {
      state = PayoutState(validationError: validationError);
      return;
    }

    state = state.copyWith(submitting: true);
    try {
      final result = await ref.read(earningsRepositoryProvider).requestPayout(
            amountTiyn: amountTiyn,
            pan: pan.replaceAll(RegExp(r'\D'), ''),
            expiry: expiry,
            holderName: holderName,
          );
      state = PayoutState(result: result);
    } on ApiException catch (e) {
      state = PayoutState(errorMessage: e.message);
    }
  }
}

final payoutControllerProvider = NotifierProvider<PayoutController, PayoutState>(
  PayoutController.new,
);
