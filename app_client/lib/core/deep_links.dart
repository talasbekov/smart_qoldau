/// Разбор входящих ссылок (App Links / Universal Links).
///
/// Единственное место разбора: тем же `resolve` пользуется обработчик пуша
/// (задача 22) и роутер. Два разбора с разными правилами разошлись бы на
/// первой же новой ссылке.
library;

import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/state/auth_controller.dart';
import 'route_paths.dart';

/// Хост, ссылки с которого приложение считает своими. Всё остальное —
/// чужой сайт: подставлять его пути в свои маршруты нельзя.
const sqDeepLinkHost = 'smartqoldau.kz';

/// Идентификаторы и slug'и в ссылках — только безопасный набор символов.
/// Ссылка это внешний ввод: `../` в пути роутера или пробелы в slug'е
/// уводили бы навигацию куда угодно.
final _safeSegment = RegExp(r'^[A-Za-z0-9_-]+$');

abstract final class DeepLinks {
  /// Маршрут приложения для [uri]. `null` — ссылка не наша или не
  /// разобрана; роутер в этом случае оставляет пользователя на главной,
  /// а не показывает пустой экран.
  ///
  /// Схема ссылок зафиксирована в `docs/deeplinks.md` — она общая с
  /// лендингом (эпик E10).
  static String? resolve(Uri uri) {
    if (uri.scheme != 'https' || uri.host != sqDeepLinkHost) return null;

    final segments = uri.pathSegments;
    if (segments.isEmpty) return null;

    switch (segments.first) {
      case 'e':
        final expertId = _segment(segments, 1);
        return expertId == null ? null : RoutePaths.expert(expertId);
      case 't':
        final slug = _segment(segments, 1);
        return slug == null
            ? null
            : Uri(
                path: RoutePaths.topic,
                queryParameters: {'slug': slug},
              ).toString();
      case 'sos':
        return RoutePaths.emergency;
      case 'c':
        final consultationId = _segment(segments, 1);
        return consultationId == null
            ? null
            : RoutePaths.session(consultationId);
      default:
        return null;
    }
  }

  /// То же самое, но от одного ПУТИ: Flutter отдаёт роутеру именно путь
  /// входящей ссылки (`/e/expert-1`), без схемы и хоста — проверять их там
  /// уже поздно и не на чем, зато набор допустимых префиксов тот же.
  static String? resolvePath(String path) =>
      resolve(Uri.parse('https://$sqDeepLinkHost$path'));

  static String? _segment(List<String> segments, int index) {
    if (segments.length <= index) return null;
    final value = segments[index];
    return _safeSegment.hasMatch(value) ? value : null;
  }
}

/// Куда уводит разобранная ссылка. Переопределяется в `main()` навигацией
/// роутера.
final deepLinkNavigatorProvider = Provider<void Function(String route)>(
  (ref) => (route) => developer.log(
    'некому обработать диплинк: $route',
    name: 'DeepLinks',
  ),
);

/// Применяет входящие ссылки — с учётом того, что сессия могла ещё не
/// восстановиться.
class DeepLinkHandler {
  DeepLinkHandler(this._ref) {
    _ref.listen<AsyncValue<AuthState>>(authControllerProvider, (
      previous,
      next,
    ) {
      final state = next.valueOrNull;
      if (state is AuthGuest || state is AuthRegistered) _flush();
    });
  }

  final Ref _ref;

  /// Ссылка, пришедшая до появления сессии. Применить её сразу нельзя:
  /// при `AuthUnknown` редирект-гард уводит на `/splash`, и цель
  /// потерялась бы.
  String? _pending;

  void handle(Uri uri) => _apply(DeepLinks.resolve(uri));

  /// Тот же путь, но когда ссылка пришла роутером (Flutter отдаёт только
  /// путь). Вызывается из редирект-гарда `router.dart`.
  void handlePath(String path) => _apply(DeepLinks.resolvePath(path));

  void _apply(String? route) {
    if (route == null) return;

    final state = _ref.read(authControllerProvider).valueOrNull;
    if (state is AuthGuest || state is AuthRegistered) {
      _ref.read(deepLinkNavigatorProvider)(route);
      return;
    }
    _pending = route;
  }

  void _flush() {
    final route = _pending;
    if (route == null) return;
    // Обнуляем ДО перехода: иначе повторная смена состояния сессии
    // (гость -> зарегистрированный) применила бы ссылку второй раз.
    _pending = null;
    _ref.read(deepLinkNavigatorProvider)(route);
  }
}

final deepLinkHandlerProvider = Provider<DeepLinkHandler>(
  (ref) => DeepLinkHandler(ref),
);
