/// Тонкая обёртка над `permission_handler`.
///
/// `permission_handler` — платформенный плагин на `MethodChannel`, в
/// `flutter test` без подмены канала не отвечает. Вместо мока канала (см.
/// предупреждение в `token_store.dart` про то, чем это оборачивалось для
/// других тестов файла) сужаем поверхность до одного метода: продакшен-
/// реализация ([PermissionHandlerService]) дёргает настоящий плагин, а
/// тесты подставляют фейк через `permissionServiceProvider`
/// (`ProviderScope.overrideWithValue`).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart' as ph;

/// Разрешения, которые запрашивает онбординг (БП-10 шаг 4). Микрофон и
/// камера запрашиваются здесь для объяснения пользователю заранее — задача
/// 14 запросит их ПОВТОРНО в момент самого звонка (отказ на онбординге не
/// блокирует вход и не считается финальным решением пользователя).
enum SqPermission { microphone, camera, notifications }

/// Узкий интерфейс поверх `permission_handler`.
abstract class PermissionService {
  /// Запрашивает у пользователя [permission]. Не возвращает статус —
  /// вызывающему экрану (см. `PermissionsScreen`) результат не нужен:
  /// онбординг не блокирует вход независимо от решения пользователя.
  Future<void> request(SqPermission permission);
}

/// Реализация [PermissionService] поверх настоящего `permission_handler`.
class PermissionHandlerService implements PermissionService {
  const PermissionHandlerService();

  @override
  Future<void> request(SqPermission permission) async {
    await _platformPermission(permission).request();
  }

  ph.Permission _platformPermission(SqPermission permission) {
    switch (permission) {
      case SqPermission.microphone:
        return ph.Permission.microphone;
      case SqPermission.camera:
        return ph.Permission.camera;
      case SqPermission.notifications:
        return ph.Permission.notification;
    }
  }
}

final permissionServiceProvider = Provider<PermissionService>(
  (ref) => const PermissionHandlerService(),
);
