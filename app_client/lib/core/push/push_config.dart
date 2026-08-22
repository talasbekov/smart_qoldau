/// Настроен ли пуш-канал в этой сборке.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Пуши включаются флагом сборки: `--dart-define=PUSH_ENABLED=true`. По
/// умолчанию выключены, и тогда приложение не обращается к Firebase ни
/// одним вызовом — ключей проекта и сертификатов APNs в репозитории нет
/// (реальные `google-services.json` / `GoogleService-Info.plist` в git не
/// кладутся, см. README).
class PushConfig {
  const PushConfig({required this.enabled});

  const PushConfig.fromEnvironment()
    : enabled = const bool.fromEnvironment('PUSH_ENABLED');

  final bool enabled;
}

final pushConfigProvider = Provider<PushConfig>(
  (ref) => const PushConfig.fromEnvironment(),
);
