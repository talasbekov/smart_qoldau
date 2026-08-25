/// Состояние и контроллер полноэкранного алерта входящего оффера
/// (E7 задача 11).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/incoming_offer_alert_port.dart';

class IncomingOfferController extends Notifier<OfferNew?> {
  StreamSubscription<SqEvent>? _subscription;
  Timer? _deadlineTimer;

  @override
  OfferNew? build() {
    final events = ref.watch(sqEventsProvider);
    _subscription = events.stream.listen(_onEvent);

    ref.onDispose(() {
      _subscription?.cancel();
      _deadlineTimer?.cancel();
    });

    return null;
  }

  void _onEvent(SqEvent event) {
    switch (event) {
      case OfferNew():
        _deadlineTimer?.cancel();
        state = event;
        ref.read(incomingOfferAlertPortProvider).show(event);

        final remaining = event.deadlineAt.difference(DateTime.now());
        _deadlineTimer = Timer(
          remaining.isNegative ? Duration.zero : remaining,
          () => _clear(event.offerId),
        );
      case OfferRevoked():
        // Регрессионный тест: чужой offerId НЕ должен чистить текущий
        // оффер — иначе просроченное `offer.revoked` для предыдущего
        // оффера случайно закрыло бы алерт следующего.
        _clear(event.offerId);
      default:
        break;
    }
  }

  /// Чистит состояние, только если [offerId] совпадает с текущим показанным
  /// оффером — регрессионный тест на подстановку чужого id (см. [_onEvent]).
  /// Возвращает `true`, если состояние действительно было очищено.
  bool _applyClear(String offerId) {
    if (state?.offerId != offerId) return false;
    _deadlineTimer?.cancel();
    _deadlineTimer = null;
    state = null;
    return true;
  }

  /// Чистит состояние И закрывает диалог порта — путь `offer.revoked`/
  /// дедлайна, когда алерт закрывается СНАРУЖИ экрана. Порт не трогается
  /// вовсе, если [offerId] не совпал с текущим оффером — иначе чужой
  /// (устаревший или про уже сменившийся оффер) `dismiss` рисковал бы
  /// закрыть диалог, который к этому офферу не имеет отношения.
  void _clear(String offerId) {
    if (_applyClear(offerId)) {
      ref.read(incomingOfferAlertPortProvider).dismiss(offerId);
    }
  }

  /// Экран сам закрыл себя (`Navigator.pop` внутри `IncomingOfferScreen`
  /// после «Принять»/«Отклонить») — чистит состояние БЕЗ повторного
  /// закрытия диалога, иначе порт попытался бы закрыть уже закрытый диалог
  /// (или — что хуже — случайно ЧУЖОЙ, открывшийся поверх него).
  void handledByUser(String offerId) => _applyClear(offerId);
}

final incomingOfferControllerProvider =
    NotifierProvider<IncomingOfferController, OfferNew?>(
  IncomingOfferController.new,
);
