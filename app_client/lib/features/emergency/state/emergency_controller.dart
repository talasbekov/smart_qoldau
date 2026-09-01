/// Экстренный сценарий (БП-02, Р-16): создание приоритетной заявки.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../funnel/data/requests_repository.dart';

/// Тема экстренной заявки. Отдельного «экстренного» справочника у бэкенда
/// нет, а спрашивать тему у человека в кризисе БП-02 запрещает — берётся
/// `other` («Другое») из общего справочника (`backend/prisma/seed.ts`).
const emergencyTopicSlug = 'other';

/// Формат экстренной заявки по умолчанию: чат подключается быстрее всего и
/// не требует ни микрофона, ни разрешений. Пользователь может сменить его
/// на экране скрининга.
const emergencyDefaultFormat = SessionFormat.chat;

/// Создание экстренной заявки. Отдельный контроллер, а не `FunnelController`:
/// экстренный путь стартует с двух разных экранов (скрининг и экран
/// угрозы), и его собственный флаг занятости не должен пересекаться с
/// обычной воронкой.
class EmergencyController extends AutoDisposeAsyncNotifier<void> {
  @override
  FutureOr<void> build() {}

  /// Создаёт экстренную заявку и возвращает её.
  ///
  /// Повторный вызов, пока предыдущий в полёте, игнорируется и возвращает
  /// `null`: два быстрых тапа по «Нет» иначе создали бы две заявки, из
  /// которых вторая гарантированно упала бы с `ACTIVE_REQUEST_EXISTS`.
  Future<MatchRequest?> start({
    SessionFormat format = emergencyDefaultFormat,
  }) async {
    if (state.isLoading) return null;
    state = const AsyncLoading();
    try {
      final request = await ref
          .read(requestsRepositoryProvider)
          .create(
            topicSlug: emergencyTopicSlug,
            format: format,
            isEmergency: true,
          );
      ref.read(analyticsProvider)
        ..track(RequestCreated(requestId: request.id, isEmergency: true))
        ..track(EmergencyEscalated(requestId: request.id, stage: 'search'));
      state = const AsyncData(null);
      return request;
    } catch (error, stackTrace) {
      // Состояние снимается и в аварийной ветке (урок 4 плана эпика) —
      // иначе экран остался бы с заблокированными кнопками навсегда.
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }
}

final emergencyControllerProvider =
    AsyncNotifierProvider.autoDispose<EmergencyController, void>(
      EmergencyController.new,
    );
