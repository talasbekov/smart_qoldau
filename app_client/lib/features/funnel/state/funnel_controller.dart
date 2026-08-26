/// Создание заявки на подбор эксперта — общая точка для экрана темы
/// (задача 10), экстренного сценария (задача 11) и каталога (задача 16).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/requests_repository.dart';

/// Держит только состояние ОДНОЙ операции создания заявки: `AsyncLoading`
/// пока запрос в полёте, `AsyncError` — если он не удался. Экран рисует по
/// нему спиннер на кнопке и текст ошибки.
class FunnelController extends AutoDisposeAsyncNotifier<void> {
  @override
  FutureOr<void> build() {}

  /// Создаёт заявку и возвращает её. Ошибку НЕ глотает: вызывающему экрану
  /// нужно различать `ACTIVE_REQUEST_EXISTS` (диалог с переходом на
  /// существующую заявку) и всё остальное (текст ошибки) — состояние
  /// `AsyncError` для этого недостаточно выразительно.
  ///
  /// Состояние снимается и на исключении (урок 4 плана эпика: флаг
  /// занятости, не снятый в аварийной ветке, оставляет кнопку в вечном
  /// спиннере).
  Future<MatchRequest> create({
    required String topicSlug,
    required SessionFormat format,
    bool isEmergency = false,
    String? expertId,
  }) async {
    state = const AsyncLoading();
    try {
      final request = await ref
          .read(requestsRepositoryProvider)
          .create(
            topicSlug: topicSlug,
            format: format,
            isEmergency: isEmergency,
            expertId: expertId,
          );
      ref
          .read(analyticsProvider)
          .track(
            RequestCreated(requestId: request.id, isEmergency: isEmergency),
          );
      state = const AsyncData(null);
      return request;
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }
}

final funnelControllerProvider =
    AsyncNotifierProvider.autoDispose<FunnelController, void>(
      FunnelController.new,
    );
