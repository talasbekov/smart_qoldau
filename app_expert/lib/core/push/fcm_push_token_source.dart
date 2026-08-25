/// [PushTokenSource] поверх Firebase Messaging — копия
/// `app_client/lib/core/push/fcm_push_token_source.dart` (задача 16 E7).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../push_token_source.dart';

class FcmPushTokenSource implements PushTokenSource {
  const FcmPushTokenSource(this._port);

  final PushMessagingPort _port;

  @override
  Future<String?> token() => _port.token();
}

/// Готовый провайдер для `main()`: сам выбирает реализацию по флагу
/// `PUSH_ENABLED`. При выключенных пушах Firebase не трогается вовсе.
final fcmAwarePushTokenSourceProvider = Provider<PushTokenSource>((ref) {
  if (!ref.watch(pushConfigProvider).enabled) {
    return const NoopPushTokenSource();
  }
  return FcmPushTokenSource(ref.watch(pushMessagingPortProvider));
});
