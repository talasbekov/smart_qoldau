/// Состояние экрана Premium: статус подписки и карты для оплаты.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/premium_repository.dart';

/// Статус подписки вместе с картами: экран решает по обоим сразу —
/// оформить подписку нечем, если карт нет, и предлагать тарифы в такой
/// ситуации значит вести человека в тупик.
class PremiumState {
  const PremiumState({
    required this.status,
    required this.cards,
    required this.plans,
  });

  final PremiumStatus status;
  final List<PaymentMethod> cards;

  /// Цены из API. Пусто — если бэкенд не ответил; экран берёт запасные
  /// значения, чтобы не показывать пустое место вместо суммы.
  final PremiumPlans? plans;

  bool get hasCard => cards.isNotEmpty;
}

class PremiumController extends AutoDisposeAsyncNotifier<PremiumState> {
  @override
  FutureOr<PremiumState> build() => _load();

  Future<PremiumState> _load() async {
    final repository = ref.read(premiumRepositoryProvider);
    // Цены и статус — независимые запросы: падение справочника тарифов не
    // должно закрывать человеку доступ к своей подписке.
    PremiumPlans? plans;
    try {
      plans = await repository.plans();
    } catch (_) {
      // Справочник тарифов не ответил — экран покажет запасные значения.
      plans = null;
    }
    final status = await repository.status();
    // Карты нужны только тем, кто ещё не подписан: активной подписке
    // выбирать нечего, а лишний запрос — лишняя точка отказа.
    final cards = status.active
        ? const <PaymentMethod>[]
        : await repository.cards();
    return PremiumState(status: status, cards: cards, plans: plans);
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }

  /// Оформляет подписку. Ошибку отдаёт наружу: экран объясняет её словами
  /// приложения, а не молча возвращает прежнее состояние.
  Future<void> subscribe(PremiumPlan plan) async {
    final current = state.valueOrNull;
    final card = current?.cards.firstOrNull;
    if (card == null) return;
    final status = await ref
        .read(premiumRepositoryProvider)
        .subscribe(plan: plan, paymentMethodId: card.id);
    state = AsyncData(
      PremiumState(
        status: status,
        cards: const [],
        plans: current?.plans,
      ),
    );
  }

  Future<void> cancel() async {
    final status = await ref.read(premiumRepositoryProvider).cancel();
    state = AsyncData(
      PremiumState(
        status: status,
        cards: state.valueOrNull?.cards ?? const [],
        plans: state.valueOrNull?.plans,
      ),
    );
  }
}

final premiumControllerProvider =
    AsyncNotifierProvider.autoDispose<PremiumController, PremiumState>(
      PremiumController.new,
    );

/// Только статус подписки, без карт. Профилю и апселлу в шторке оплаты
/// нужен ответ «Premium или базовый» — тянуть ради него список карт значит
/// добавить точку отказа там, где она ничего не решает.
final premiumStatusProvider = FutureProvider.autoDispose<PremiumStatus>(
  (ref) => ref.watch(premiumRepositoryProvider).status(),
);
