/// Тонкая обёртка над `url_launcher`.
///
/// `url_launcher` — платформенный плагин на `MethodChannel`, в
/// `flutter test` без подмены канала не отвечает (см. `permission_service
/// .dart` про то же самое решение и почему подмена платформенного канала
/// здесь сознательно не используется). Продакшен-реализация
/// ([UrlLauncherAdapter]) открывает настоящую ссылку, а тесты подставляют
/// фейк через `urlLauncherPortProvider`, проверяя, какой именно URL был
/// передан — не трогая платформу.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart' as launcher;

/// Узкий интерфейс поверх `url_launcher`.
abstract class UrlLauncherPort {
  Future<void> launch(String url);
}

/// Реализация [UrlLauncherPort] поверх настоящего `url_launcher`.
class UrlLauncherAdapter implements UrlLauncherPort {
  const UrlLauncherAdapter();

  @override
  Future<void> launch(String url) async {
    await launcher.launchUrl(
      Uri.parse(url),
      mode: launcher.LaunchMode.externalApplication,
    );
  }
}

final urlLauncherPortProvider = Provider<UrlLauncherPort>(
  (ref) => const UrlLauncherAdapter(),
);
