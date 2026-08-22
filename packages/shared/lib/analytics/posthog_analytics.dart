/// Отправка событий в self-hosted PostHog (ТЗ §10).
library;

import 'dart:developer' as developer;

import 'package:dio/dio.dart';

import 'analytics_event.dart';
import 'analytics_port.dart';

class PostHogAnalytics implements AnalyticsPort {
  PostHogAnalytics({required Dio dio, required String apiKey})
    : _dio = dio,
      _apiKey = apiKey;

  final Dio _dio;
  final String _apiKey;

  /// Пока `identify` не вызван, события уходят под анонимным
  /// идентификатором сессии: терять начало воронки (человек ещё не вошёл,
  /// но уже выбрал тему) нельзя.
  String _distinctId = 'anonymous';
  bool _isGuest = true;

  @override
  Future<void> identify(String distinctId, {required bool isGuest}) async {
    _distinctId = distinctId;
    _isGuest = isGuest;
  }

  @override
  Future<void> track(AnalyticsEvent event) async {
    try {
      await _dio.post<void>(
        '/capture/',
        data: {
          'api_key': _apiKey,
          'event': event.name,
          'distinct_id': _distinctId,
          'properties': {...event.properties, 'is_guest': _isGuest},
        },
      );
    } catch (error) {
      // Сбой аналитики никогда не влияет на интерфейс — та же дисциплина,
      // что у `dispatch()` на бэкенде: логируем тип и живём дальше.
      developer.log(
        'событие аналитики не отправлено: ${error.runtimeType}',
        name: 'PostHogAnalytics',
      );
    }
  }
}
