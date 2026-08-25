/// Источник push-токена устройства — та же абстракция, что
/// `app_client/lib/core/push_token_source.dart` (не транспортный код
/// `shared`, а seam конкретного приложения, задача 16 E7): ключей Firebase
/// в проекте нет, но регистрация устройства/локаль/перерегистрация при
/// смене языка пишутся и проверяются уже сейчас.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

abstract class PushTokenSource {
  /// `null` — токена нет (push не настроен или пользователь отказал в
  /// уведомлениях). Регистрация устройства в этом случае НЕ выполняется.
  Future<String?> token();
}

class NoopPushTokenSource implements PushTokenSource {
  const NoopPushTokenSource();

  @override
  Future<String?> token() async => null;
}

final pushTokenSourceProvider = Provider<PushTokenSource>(
  (ref) => const NoopPushTokenSource(),
);
