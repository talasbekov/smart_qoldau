/// Аналитика, которая ничего не отправляет.
library;

import 'analytics_event.dart';
import 'analytics_port.dart';

/// Реализация по умолчанию: без адреса и ключа PostHog события никуда не
/// уходят. Приложение при этом работает ровно так же — вызовы трекинга
/// остаются на местах.
class NoopAnalytics implements AnalyticsPort {
  const NoopAnalytics();

  @override
  Future<void> track(AnalyticsEvent event) async {}

  @override
  Future<void> identify(String distinctId, {required bool isGuest}) async {}
}
