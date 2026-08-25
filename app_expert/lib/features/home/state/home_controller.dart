/// Состояние и контроллер главного экрана эксперта (E7 задача 10):
/// статус приёма и presence-heartbeat.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/home_repository.dart';

/// Как часто отправляется `POST /experts/me/heartbeat`, пока
/// `workStatus == accepting`.
const heartbeatInterval = Duration(seconds: 20);

class HomeController extends AsyncNotifier<ExpertMe> {
  Timer? _heartbeatTimer;
  bool _disposed = false;
  bool _heartbeatInFlight = false;

  @override
  FutureOr<ExpertMe> build() async {
    ref.onDispose(() {
      _disposed = true;
      _stopHeartbeat();
    });

    final me = await ref.read(homeRepositoryProvider).me();
    if (me.workStatus == WorkStatus.accepting) _startHeartbeat();
    return me;
  }

  /// Переключает статус приёма заявок. Попытка `ACCEPTING`, когда профиль
  /// ещё не `VERIFIED`, показывает предсказуемую ошибку БЕЗ сетевого
  /// вызова — контроллер уже знает `verificationStatus` из своего
  /// состояния, нет смысла ждать ответ сервера ради того же самого отказа
  /// (см. бриф задачи 10).
  Future<void> setStatus(WorkStatus status) async {
    final current = state.valueOrNull;
    if (status == WorkStatus.accepting &&
        current != null &&
        current.verificationStatus != VerificationStatus.verified) {
      throw const ApiException(
        ApiErrorCode.notVerified,
        'Профиль ещё не прошёл проверку',
        0,
      );
    }

    final updated = await ref
        .read(homeRepositoryProvider)
        .setWorkStatus(status);
    if (_disposed) return;
    state = AsyncData(updated);
    if (updated.workStatus == WorkStatus.accepting) {
      _startHeartbeat();
    } else {
      _stopHeartbeat();
    }
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(heartbeatInterval, (_) => _heartbeat());
  }

  /// Останавливает heartbeat — вызывается и при `dispose` (см. [build]), и
  /// как только статус перестаёт быть `ACCEPTING`: незакрытый `Timer`
  /// после этого считался бы утечкой и тратил бы батарею/запросы впустую.
  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  Future<void> _heartbeat() async {
    // Медленная сеть не должна копить параллельные запросы (тот же приём,
    // что у `VerificationStatusController._poll`).
    if (_heartbeatInFlight) return;
    _heartbeatInFlight = true;
    try {
      await ref.read(homeRepositoryProvider).heartbeat();
    } catch (_) {
      // Presence best-effort: пропущенный heartbeat не должен ронять экран.
    } finally {
      _heartbeatInFlight = false;
    }
  }
}

final homeControllerProvider = AsyncNotifierProvider<HomeController, ExpertMe>(
  HomeController.new,
);
