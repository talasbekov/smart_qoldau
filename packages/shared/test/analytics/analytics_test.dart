// Тесты аналитики воронки (Step 1 брифа задачи 24 эпика E6): формат тела
// запроса PostHog, устойчивость к сбоям и PII-инвариант событий.
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

void main() {
  group('NoopAnalytics', () {
    test('ничего никуда не шлёт и не бросает', () async {
      const analytics = NoopAnalytics();

      await analytics.identify('u1', isGuest: true);
      await analytics.track(const TopicSelected(topicSlug: 'anxiety-stress'));
    });
  });

  group('PostHogAnalytics', () {
    late Dio dio;
    late DioAdapter adapter;
    late PostHogAnalytics analytics;

    setUp(() {
      dio = Dio(BaseOptions(baseUrl: 'https://posthog.test.local'));
      adapter = DioAdapter(dio: dio);
      analytics = PostHogAnalytics(dio: dio, apiKey: 'phc_test');
      analytics.identify('u1', isGuest: false);
    });

    test('формирует тело capture по контракту PostHog', () async {
      Map<String, dynamic>? captured;
      adapter.onPost(
        '/capture/',
        (server) => server.reply(200, {'status': 1}),
        data: Matchers.any,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            captured = options.data as Map<String, dynamic>;
            handler.next(options);
          },
        ),
      );

      await analytics.track(const TopicSelected(topicSlug: 'anxiety-stress'));

      expect(captured!['api_key'], 'phc_test');
      expect(captured!['event'], 'topic_selected');
      expect(captured!['distinct_id'], 'u1');
      expect((captured!['properties'] as Map)['topic_slug'], 'anxiety-stress');
    });

    test('сбой сети не бросает наружу', () async {
      // Аналитика никогда не должна влиять на интерфейс: та же дисциплина,
      // что у `dispatch()` на бэкенде.
      adapter.onPost(
        '/capture/',
        (server) => server.reply(500, {'error': 'boom'}),
        data: Matchers.any,
      );

      await expectLater(analytics.track(const GuestConverted()), completes);
    });

    test(
      'без identify событие всё равно уходит с гостевым distinct_id',
      () async {
        final fresh = PostHogAnalytics(dio: dio, apiKey: 'phc_test');
        Map<String, dynamic>? captured;
        adapter.onPost(
          '/capture/',
          (server) => server.reply(200, {'status': 1}),
          data: Matchers.any,
        );
        dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              captured = options.data as Map<String, dynamic>;
              handler.next(options);
            },
          ),
        );

        await fresh.track(
          const EmergencyEscalated(requestId: 'r1', stage: 'hotlines'),
        );

        expect(captured!['distinct_id'], isNotEmpty);
      },
    );
  });

  group('PII-инвариант', () {
    test('ни одно свойство события не содержит персональных данных', () {
      // Табличный проход по ВСЕМ вариантам событий: новый вариант с
      // телефоном или текстом отзыва обязан уронить этот тест.
      final events = <AnalyticsEvent>[
        const TopicSelected(topicSlug: 'anxiety-stress'),
        const FormatSelected(format: 'chat'),
        const RequestCreated(requestId: 'r1', isEmergency: false),
        const ExpertMatched(requestId: 'r1', secondsToMatch: 42),
        const PaymentSucceeded(consultationId: 'c1', priceTiyn: 399000),
        const PaymentDeclined(consultationId: 'c1', code: 'PROVIDER_DECLINED'),
        const SessionStarted(consultationId: 'c1', format: 'chat'),
        const SessionEnded(
          consultationId: 'c1',
          outcome: 'COMPLETED',
          durationSec: 2900,
        ),
        const ReviewSubmitted(consultationId: 'c1', rating: 5),
        const GuestConverted(),
        const EmergencyEscalated(requestId: 'r1', stage: 'hotlines'),
      ];

      const forbidden = [
        'phone',
        'text',
        'maskedPan',
        'masked_pan',
        'displayName',
        'display_name',
        'name',
        'email',
        'pan',
      ];

      for (final event in events) {
        for (final key in event.properties.keys) {
          expect(
            forbidden.contains(key),
            isFalse,
            reason:
                'событие ${event.name}: свойство "$key" — персональные '
                'данные, аналитике оно не принадлежит',
          );
        }
        for (final value in event.properties.values) {
          expect(
            value,
            anyOf(isA<String>(), isA<num>(), isA<bool>(), isNull),
            reason:
                'свойства событий должны быть примитивами: вложенные '
                'объекты легко протаскивают ПД целиком',
          );
        }
      }
    });

    test('имена событий — snake_case из ТЗ §10', () {
      expect(const TopicSelected(topicSlug: 't').name, 'topic_selected');
      expect(
        const ExpertMatched(requestId: 'r', secondsToMatch: 1).name,
        'expert_matched',
      );
      expect(const GuestConverted().name, 'guest_converted');
    });
  });
}
