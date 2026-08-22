/// Аналитика приложения (ТЗ §10).
///
/// По умолчанию — [NoopAnalytics]: без адреса и ключа PostHog события
/// никуда не уходят, а вызовы трекинга на экранах остаются на местах.
/// Включается флагами сборки:
/// `--dart-define=POSTHOG_HOST=https://posthog.example --dart-define=POSTHOG_KEY=phc_...`
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

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
