/// Данные экрана «специалист найден»: кто найден и за сколько.
///
/// Отдельный файл, которого нет в списке брифа: экран открывается по
/// `/found/:requestId`, а показать обязан и специалиста (он в заявке), и
/// цену с длительностью (они в консультации) — это две загрузки, и держать
/// их в виджете значило бы перезапрашивать их на каждой перестройке.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../funnel/data/requests_repository.dart';
import '../data/payments_repository.dart';

class FoundState {
  const FoundState({required this.expert, required this.consultation});

  final ExpertPublic expert;
  final ClientConsultation consultation;
}

/// Заявка есть, но матча в ней нет — экран «специалист найден» открыт не по
/// адресу (прямая ссылка на закрытую заявку, устаревший пуш).
class FoundNotMatchedException implements Exception {
  const FoundNotMatchedException();
}

class FoundController
    extends AutoDisposeFamilyAsyncNotifier<FoundState, String> {
  @override
  FutureOr<FoundState> build(String requestId) => _load();

  Future<FoundState> _load() async {
    // Источник истины о матче — заявка, а не `extra` навигации: экран
    // открывается и по пушу, и по прямой ссылке.
    final request = await ref.read(requestsRepositoryProvider).get(arg);
    final consultationId = request.consultationId;
    final expert = request.matchedExpert;
    if (consultationId == null || expert == null) {
      throw const FoundNotMatchedException();
    }

    final consultation = await ref
        .read(paymentsRepositoryProvider)
        .consultation(consultationId);
    return FoundState(expert: expert, consultation: consultation);
  }

  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }

  /// Отказ от найденного специалиста: консультация отменяется на бэкенде.
  Future<void> cancelConsultation() async {
    final current = state.valueOrNull;
    if (current == null) return;
    await ref
        .read(paymentsRepositoryProvider)
        .cancelConsultation(current.consultation.id);
  }
}

final foundControllerProvider = AsyncNotifierProvider.autoDispose
    .family<FoundController, FoundState, String>(FoundController.new);
