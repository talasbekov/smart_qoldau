/// Три раздела главного списка эксперта (E7 задача 12): «Заявки» (офферы),
/// «Идёт сейчас»/«Плановые» (`ACTIVE`+`SCHEDULED`), «История»
/// (`COMPLETED`+`CANCELLED`). Каждый раздел грузится и обновляется
/// НЕЗАВИСИМО — сбой одного (например, сеть моргнула между тремя
/// запросами) не должен блокировать два остальных.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../offers/data/offers_repository.dart';
import '../data/expert_consultations_repository.dart';

/// Статусы, объединяемые в раздел «Идёт сейчас»/«Плановые» — консультация,
/// которую ещё предстоит или уже пора провести.
const activeConsultationStatuses = [
  ConsultationStatus.scheduled,
  ConsultationStatus.active,
];

/// Статусы, объединяемые в «Историю» — тот же приём, что у клиента
/// (`app_client/lib/features/consultations/state/consultations_controller.dart`).
const historyConsultationStatuses = [
  ConsultationStatus.completed,
  ConsultationStatus.cancelled,
];

class ExpertConsultationsState {
  const ExpertConsultationsState({
    this.offers = const AsyncLoading(),
    this.active = const AsyncLoading(),
    this.history = const AsyncLoading(),
  });

  final AsyncValue<List<OfferDto>> offers;
  final AsyncValue<List<ConsultationExpertDto>> active;
  final AsyncValue<List<ConsultationExpertDto>> history;

  ExpertConsultationsState copyWith({
    AsyncValue<List<OfferDto>>? offers,
    AsyncValue<List<ConsultationExpertDto>>? active,
    AsyncValue<List<ConsultationExpertDto>>? history,
  }) => ExpertConsultationsState(
    offers: offers ?? this.offers,
    active: active ?? this.active,
    history: history ?? this.history,
  );
}

/// Склеивает несколько статусов в один список: новые сверху.
List<ConsultationExpertDto> _merge(Iterable<List<ConsultationExpertDto>> pages) {
  final list = pages.expand((page) => page).toList()
    ..sort((a, b) => b.startedAt.compareTo(a.startedAt));
  return list;
}

class ExpertConsultationsController extends Notifier<ExpertConsultationsState> {
  @override
  ExpertConsultationsState build() {
    // Каждый раздел запускается сам по себе — не await'ится здесь: `build`
    // не должен ждать самый медленный из трёх запросов, чтобы показать
    // уже пришедшие разделы.
    Future.microtask(refreshOffers);
    Future.microtask(refreshActive);
    Future.microtask(refreshHistory);
    return const ExpertConsultationsState();
  }

  Future<void> refreshOffers() async {
    state = state.copyWith(offers: const AsyncLoading<List<OfferDto>>());
    try {
      final offers = await ref.read(offersRepositoryProvider).myOffers();
      state = state.copyWith(offers: AsyncData(offers));
    } catch (e, st) {
      state = state.copyWith(offers: AsyncError(e, st));
    }
  }

  Future<void> refreshActive() => _refreshSection(
        statuses: activeConsultationStatuses,
        apply: (value) => state = state.copyWith(active: value),
      );

  Future<void> refreshHistory() => _refreshSection(
        statuses: historyConsultationStatuses,
        apply: (value) => state = state.copyWith(history: value),
      );

  Future<void> _refreshSection({
    required List<ConsultationStatus> statuses,
    required void Function(AsyncValue<List<ConsultationExpertDto>> value) apply,
  }) async {
    apply(const AsyncLoading<List<ConsultationExpertDto>>());
    try {
      final repo = ref.read(expertConsultationsRepositoryProvider);
      final pages = await Future.wait(statuses.map((s) => repo.list(status: s)));
      apply(AsyncData(_merge(pages)));
    } catch (e, st) {
      apply(AsyncError(e, st));
    }
  }
}

final expertConsultationsControllerProvider = NotifierProvider<
    ExpertConsultationsController, ExpertConsultationsState>(
  ExpertConsultationsController.new,
);
