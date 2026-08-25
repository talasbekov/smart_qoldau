/// [PushTokenSource] поверх Firebase Messaging.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../push_token_source.dart';

/// Токен берётся у Firebase — но только если пуши включены флагом сборки.
/// При выключенных пушах в провайдере остаётся `NoopPushTokenSource`, и
/// Firebase не трогается вовсе.
class FcmPushTokenSource implements PushTokenSource {
  const FcmPushTokenSource(this._port);

  final PushMessagingPort _port;

  @override
  Future<String?> token() => _port.token();
}

/// Готовый провайдер для `main()`: сам выбирает реализацию по флагу.
final fcmAwarePushTokenSourceProvider = Provider<PushTokenSource>((ref) {
  if (!ref.watch(pushConfigProvider).enabled) {
    return const NoopPushTokenSource();
  }
  return FcmPushTokenSource(ref.watch(pushMessagingPortProvider));
});
