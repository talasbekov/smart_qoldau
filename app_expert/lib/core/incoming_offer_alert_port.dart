/// Порт полноэкранного алерта входящего оффера (E7 задача 11).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../features/offers/ui/incoming_offer_screen.dart';
import 'providers.dart';

/// Полноэкранный алерт входящего оффера — работает, пока процесс живёт в
/// foreground или background (Android/iOS не выгрузили приложение). Из
/// killed-state НЕ срабатывает — см. Global Constraints этого плана.
// ДОЛГ (вне объёма E7): killed-state wake через CallKit/PushKit недостижим
// без боевого push-провайдера и VoIP-токена на бэкенде — см. Global
// Constraints плана E7.
abstract class IncomingOfferAlertPort {
  void show(OfferNew offer);
  void dismiss(String offerId);
}

/// Реализация через `showDialog` поверх текущего маршрута — оффер может
/// прийти на любом экране, отдельный маршрут для него сломал бы стек
/// навигации (пришлось бы откатывать `pop` до места, где эксперт был ДО
/// оффера). `barrierDismissible: false` — тап по фону не должен молча
/// закрывать оффер (это не то же самое, что «Отклонить»).
///
/// [dismiss] закрывает диалог, только если он всё ещё открыт для ТОГО ЖЕ
/// [offerId] — вызов после того, как эксперт сам принял/отклонил оффер
/// (диалог уже закрылся сам через `Navigator.pop` в `IncomingOfferScreen`),
/// не должен закрывать какой-то другой открывшийся поверх экран.
class NavigatorIncomingOfferAlertPort implements IncomingOfferAlertPort {
  NavigatorIncomingOfferAlertPort(this._navigatorKey);

  final GlobalKey<NavigatorState> _navigatorKey;

  /// Оффер, чей диалог сейчас открыт этим портом — `null`, если нет.
  String? _shownOfferId;

  @override
  void show(OfferNew offer) {
    if (_shownOfferId == offer.offerId) return;
    final context = _navigatorKey.currentContext;
    if (context == null) return;

    _shownOfferId = offer.offerId;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      useRootNavigator: true,
      builder: (_) => IncomingOfferScreen(offer: offer),
    ).whenComplete(() {
      if (_shownOfferId == offer.offerId) _shownOfferId = null;
    });
  }

  @override
  void dismiss(String offerId) {
    if (_shownOfferId != offerId) return;
    final navigator = _navigatorKey.currentState;
    if (navigator != null && navigator.canPop()) navigator.pop();
    _shownOfferId = null;
  }
}

final incomingOfferAlertPortProvider = Provider<IncomingOfferAlertPort>(
  (ref) => NavigatorIncomingOfferAlertPort(ref.watch(appNavigatorKeyProvider)),
);
