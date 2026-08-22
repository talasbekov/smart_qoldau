/// Порт аналитики.
library;

import 'analytics_event.dart';

abstract class AnalyticsPort {
  /// Отправляет событие. Реализация обязана быть fire-and-forget: сбой
  /// аналитики никогда не влияет на интерфейс.
  Future<void> track(AnalyticsEvent event);

  /// Связывает последующие события с пользователем. `distinctId` — тот же
  /// идентификатор, что в JWT (`sub`); для гостя — гостевой id. Телефон и
  /// прочие ПД сюда не передаются.
  Future<void> identify(String distinctId, {required bool isGuest});
}
