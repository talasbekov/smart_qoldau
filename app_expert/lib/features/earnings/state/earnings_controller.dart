/// Список начислений эксперта и текущий баланс (E7 задача 14).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/earnings_repository.dart';

class EarningsController extends AsyncNotifier<EarningsDto> {
  @override
  FutureOr<EarningsDto> build() =>
      ref.read(earningsRepositoryProvider).earnings();

  Future<void> refresh() async {
    state = await AsyncValue.guard(
      () => ref.read(earningsRepositoryProvider).earnings(),
    );
  }
}

final earningsControllerProvider =
    AsyncNotifierProvider<EarningsController, EarningsDto>(
      EarningsController.new,
    );
