/// Источник push-токена устройства.
///
/// Абстракция, а не прямой вызов FCM/APNs: ключей Firebase и сертификатов
/// APNs в проекте нет (см. «Заблокировано внешними обстоятельствами» в плане
/// эпика E6), а весь остальной код — регистрация устройства, локаль,
/// перерегистрация при смене языка — писать и проверять можно уже сейчас.
/// Появятся ключи — добавится `FcmPushTokenSource`, экраны не изменятся.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

abstract class PushTokenSource {
  /// `null` — токена нет (push не настроен или пользователь отказал в
  /// уведомлениях). Регистрация устройства в этом случае НЕ выполняется:
  /// пустая запись в `devices` бэкенду не нужна.
  Future<String?> token();
}

/// Реализация по умолчанию: токена нет.
class NoopPushTokenSource implements PushTokenSource {
  const NoopPushTokenSource();

  @override
  Future<String?> token() async => null;
}

final pushTokenSourceProvider = Provider<PushTokenSource>(
  (ref) => const NoopPushTokenSource(),
);
