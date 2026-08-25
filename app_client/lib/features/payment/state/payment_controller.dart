/// Оплата консультации эскроу-холдом (Р-01).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/payments_repository.dart';

enum PaymentPhase { idle, processing, paid, declined }

class PaymentState {
  const PaymentState({
    this.phase = PaymentPhase.idle,
    this.providerMessage,
    this.errorCode,
    this.cardsStale = false,
  });

  final PaymentPhase phase;

  /// Текст отказа, пришедший от платёжного провайдера (`PROVIDER_DECLINED`).
  /// Показывается пользователю как есть: провайдер знает причину отказа
  /// точнее, чем общий словарь ошибок.
  final String? providerMessage;

  /// Код ошибки для локализованного текста, когда своего сообщения нет.
  final String? errorCode;

  /// Карта, которой платили, на бэкенде не найдена — список карт устарел и
  /// его нужно перечитать (экран делает это, увидев флаг).
  final bool cardsStale;
}

class PaymentController extends AutoDisposeNotifier<PaymentState> {
  @override
  PaymentState build() => const PaymentState();

  /// Холдирует стоимость консультации на карте.
  ///
  /// Повторный вызов, пока запрос в полёте, игнорируется: второй холд —
  /// это вторые замороженные деньги на карте клиента.
  Future<void> pay({
    required String consultationId,
    required String paymentMethodId,
    // Цена нужна только аналитике (ТЗ §10) — сам платёж считает бэкенд.
    int priceTiyn = 0,
  }) async {
    if (state.phase == PaymentPhase.processing) return;
    state = const PaymentState(phase: PaymentPhase.processing);

    try {
      final result = await ref
          .read(paymentsRepositoryProvider)
          .pay(
            consultationId: consultationId,
            paymentMethodId: paymentMethodId,
          );
      if (result.status == PaymentStatus.held) {
        ref.read(analyticsProvider).track(
          PaymentSucceeded(
            consultationId: consultationId,
            priceTiyn: priceTiyn,
          ),
        );
      }
      state = switch (result.status) {
        // HELD — единственный успешный исход холда (Р-01). CAPTURED здесь
        // означал бы, что деньги уже списаны до консультации — такого
        // бэкенд не делает, но и обрабатывать его как успех «на всякий
        // случай» нельзя: клиент должен увидеть отказ, а не пустую сессию.
        PaymentStatus.held => const PaymentState(phase: PaymentPhase.paid),
        _ => PaymentState(
          phase: PaymentPhase.declined,
          errorCode: ApiErrorCode.providerDeclined,
        ),
      };
    } on ApiException catch (error) {
      ref.read(analyticsProvider).track(
        PaymentDeclined(consultationId: consultationId, code: error.code),
      );
      state = switch (error.code) {
        // Ответ первой попытки потерялся, а деньги уже захолдированы:
        // показать ошибку значило бы предложить клиенту заплатить дважды.
        ApiErrorCode.alreadyPaid => const PaymentState(
          phase: PaymentPhase.paid,
        ),
        ApiErrorCode.providerDeclined => PaymentState(
          phase: PaymentPhase.declined,
          providerMessage: error.message,
          errorCode: error.code,
        ),
        ApiErrorCode.paymentMethodNotFound => PaymentState(
          phase: PaymentPhase.declined,
          errorCode: error.code,
          cardsStale: true,
        ),
        _ => PaymentState(phase: PaymentPhase.declined, errorCode: error.code),
      };
    } catch (error) {
      state = const PaymentState(phase: PaymentPhase.declined);
    }
  }

  /// Возврат к выбору карты после отказа.
  void reset() => state = const PaymentState();
}

final paymentControllerProvider =
    NotifierProvider.autoDispose<PaymentController, PaymentState>(
      PaymentController.new,
    );
