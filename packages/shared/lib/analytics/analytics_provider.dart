/// Аналитика приложения (ТЗ §10).
///
/// По умолчанию — [NoopAnalytics]: без адреса и ключа PostHog события
/// никуда не уходят, а вызовы трекинга на экранах остаются на местах.
/// Включается флагами сборки:
/// `--dart-define=POSTHOG_HOST=https://posthog.example --dart-define=POSTHOG_KEY=phc_...`
///
/// Задача 2 (E7): перенесён из `app_client/lib/core/analytics_provider.dart`
/// без изменений — ни одной зависимости от `app_client` тут не было (только
/// `dio` и типы этого же пакета), поэтому это прямой перенос, а не
/// placeholder-заглушка (в отличие от `sqApiProvider`/`sqEventsProvider`).
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'analytics_port.dart';
import 'noop_analytics.dart';
import 'posthog_analytics.dart';

const _posthogHost = String.fromEnvironment('POSTHOG_HOST');
const _posthogKey = String.fromEnvironment('POSTHOG_KEY');

final analyticsProvider = Provider<AnalyticsPort>((ref) {
  if (_posthogHost.isEmpty || _posthogKey.isEmpty) {
    return const NoopAnalytics();
  }
  return PostHogAnalytics(
    dio: Dio(BaseOptions(baseUrl: _posthogHost)),
    apiKey: _posthogKey,
  );
});
