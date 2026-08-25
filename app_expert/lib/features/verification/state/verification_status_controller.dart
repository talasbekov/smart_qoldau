/// Состояние и контроллер экрана статуса верификации (E7 задача 6).
///
/// Единственный источник истины — `ExpertMe` (`GET /experts/me`): бэкенд
/// не шлёт WS-событий про верификацию и не имеет отдельного эндпоинта «моя
/// верификация» (подтверждено чтением контроллеров, см. бриф задачи).
/// Поэтому статус обновляется тем же страховочным REST-опросом, что и
/// заявка клиента в E6 задаче 10 (`SearchController` в `app_client`):
/// `Timer.periodic` раз в 30 секунд, пока `verificationStatus != VERIFIED`.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/verification_repository.dart';

/// Как часто перечитывается `ExpertMe`, пока верификация не завершена.
const verificationPollInterval = Duration(seconds: 30);

class VerificationStatusController extends AutoDisposeAsyncNotifier<ExpertMe> {
  Timer? _pollTimer;
  bool _disposed = false;
  bool _pollInFlight = false;

  @override
  FutureOr<ExpertMe> build() async {
    ref.onDispose(() {
      _disposed = true;
      _stopPolling();
    });

    final me = await ref.read(verificationRepositoryProvider).me();
    if (me.verificationStatus != VerificationStatus.verified) {
      _startPolling();
    }
    return me;
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(verificationPollInterval, (_) => _poll());
  }

  /// Останавливает опрос — вызывается и при `dispose` (см. [build]), и как
  /// только приходит `VERIFIED` (см. [_poll]): дальше опрашивать нечего, а
  /// незакрытый `Timer` после ухода эксперта с экрана считался бы утечкой.
  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _poll() async {
    // Медленная сеть (ответ дольше интервала) не должна копить параллельные
    // запросы — тот же приём, что у `SearchController` в `app_client`.
    if (_pollInFlight) return;
    _pollInFlight = true;
    try {
      final me = await ref.read(verificationRepositoryProvider).me();
      if (_disposed) return;
      state = AsyncData(me);
      if (me.verificationStatus == VerificationStatus.verified) {
        _stopPolling();
      }
    } catch (_) {
      // Страховочный опрос — best-effort: сбой сети не должен превращать
      // рабочий экран статуса в экран ошибки (тот же принцип, что у
      // `SearchController._poll`).
    } finally {
      _pollInFlight = false;
    }
  }

  /// Ручное обновление (кнопка «Повторить» на экране ошибки). Перезапускает
  /// опрос, если статус после обновления всё ещё не `VERIFIED`.
  Future<void> refresh() async {
    state = const AsyncLoading<ExpertMe>().copyWithPrevious(state);
    state = await AsyncValue.guard(() => ref.read(verificationRepositoryProvider).me());
    final me = state.valueOrNull;
    if (me == null) return;
    if (me.verificationStatus == VerificationStatus.verified) {
      _stopPolling();
    } else {
      _startPolling();
    }
  }
}

final verificationStatusControllerProvider =
    AsyncNotifierProvider.autoDispose<VerificationStatusController, ExpertMe>(
  VerificationStatusController.new,
);
