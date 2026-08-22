/// Список привязанных карт клиента.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/payments_repository.dart';

class CardsController extends AutoDisposeAsyncNotifier<List<PaymentMethod>> {
  @override
  FutureOr<List<PaymentMethod>> build() =>
      ref.read(paymentsRepositoryProvider).cards();

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(paymentsRepositoryProvider).cards(),
    );
  }

  /// Открепляет карту и перечитывает список — ответ `DELETE` пустой, а
  /// вычёркивать элемент локально значило бы поверить, что бэкенд не
  /// изменил больше ничего.
  Future<void> remove(String id) async {
    await ref.read(paymentsRepositoryProvider).deleteCard(id);
    await reload();
  }
}

final cardsControllerProvider =
    AsyncNotifierProvider.autoDispose<CardsController, List<PaymentMethod>>(
      CardsController.new,
    );
