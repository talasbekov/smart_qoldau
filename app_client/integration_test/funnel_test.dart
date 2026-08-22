// Сквозной прогон воронки клиента против ЖИВОГО бэкенда (Step 2 брифа
// задачи 20 эпика E6).
//
// Что проверяется одним сценарием: гостевой вход -> тема -> формат ->
// заявка -> счётчик онлайна -> принятие оффера экспертом -> «специалист
// найден» -> привязка карты -> оплата холдом -> чат с эхом сообщения ->
// завершение консультации экспертом -> оценка -> история со статусами.
//
// Запуск (нужны поднятый бэкенд и устройство/эмулятор):
//   cd backend && npm run start:dev
//   cd app_client && flutter test integration_test/funnel_test.dart \
//     -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000/v1 \
//     --dart-define=WS_BASE_URL=http://10.0.2.2:3000
//
// Роль эксперта играет прямой HTTP-клиент внутри теста: экспертного
// приложения в этом эпике нет, а без второй стороны воронку не пройти.
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/app.dart';
import 'package:app_client/core/locale_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Адрес бэкенда для служебных вызовов теста (эксперт, сид). Тот же, что и
/// у приложения: `--dart-define=API_BASE_URL`.
const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000/v1',
);

/// Тестовый телефон эксперта. В dev-режиме бэкенд принимает фиксированный
/// код (`SMS_DEV_CODE`), поэтому SMS не нужны.
const _expertPhone = '+77015550101';
const _devSmsCode = '000000';

/// Второй участник консультации: логинится, поднимает профиль эксперта,
/// принимает оффер и завершает консультацию.
class _ExpertSide {
  _ExpertSide() : _dio = Dio(BaseOptions(baseUrl: _apiBaseUrl));

  final Dio _dio;
  String? _token;

  Options get _auth => Options(
    headers: {'Authorization': 'Bearer $_token'},
  );

  Future<void> signIn() async {
    await _dio.post<void>('/auth/request-code', data: {'phone': _expertPhone});
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/verify',
      data: {'phone': _expertPhone, 'code': _devSmsCode},
    );
    _token = response.data!['accessToken'] as String;
  }

  /// Создаёт (или обновляет) профиль эксперта и переводит его в приём
  /// заявок. Верификацию в dev-режиме выполняет сид/админ-скрипт.
  Future<void> becomeAvailable({required String topicSlug}) async {
    await _dio.post<void>(
      '/experts',
      data: {
        'displayName': 'Интеграционный С.',
        'city': 'Алматы',
        'experience': 'THREE_TO_FIVE',
        'priceTiyn': 399000,
        'languages': ['ru'],
        'formats': ['chat', 'audio', 'video'],
        'topicSlugs': [topicSlug],
      },
      options: _auth,
    );
    await _dio.patch<void>(
      '/experts/me/work-status',
      data: {'workStatus': 'ACCEPTING'},
      options: _auth,
    );
    await _dio.post<void>('/experts/me/heartbeat', options: _auth);
  }

  /// Ждёт оффер и принимает его. Возвращает id консультации.
  Future<String> acceptOffer() async {
    for (var attempt = 0; attempt < 30; attempt++) {
      final offers = await _dio.get<List<dynamic>>(
        '/experts/me/offers',
        options: _auth,
      );
      if (offers.data!.isNotEmpty) {
        final offerId = (offers.data!.first as Map)['id'] as String;
        final accepted = await _dio.post<Map<String, dynamic>>(
          '/offers/$offerId/accept',
          options: _auth,
        );
        return accepted.data!['consultationId'] as String;
      }
      await Future<void>.delayed(const Duration(seconds: 1));
    }
    fail('эксперт не дождался оффера за 30 секунд');
  }

  Future<void> complete(String consultationId) => _dio.post<void>(
    '/consultations/$consultationId/complete',
    data: {'outcome': 'COMPLETED'},
    options: _auth,
  );
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late _ExpertSide expert;

  setUpAll(() async {
    expert = _ExpertSide();
    await expert.signIn();
    await expert.becomeAvailable(topicSlug: 'anxiety-stress');
  });

  testWidgets('воронка клиента: от темы до оценки и истории', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        child: const SqClientApp(),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Гостевой вход.
    await tester.tap(find.byKey(const Key('sq-welcome-guest-button')));
    await tester.pumpAndSettle();

    // Онбординг: слайды пропускаем целиком, разрешения откладываем.
    if (find.text('Пропустить').evaluate().isNotEmpty) {
      await tester.tap(find.text('Пропустить'));
      await tester.pumpAndSettle();
    }
    if (find.byKey(const Key('sq-permissions-later-button')).evaluate().isNotEmpty) {
      await tester.tap(find.byKey(const Key('sq-permissions-later-button')));
      await tester.pumpAndSettle();
    }

    // 2. Тема -> формат -> заявка.
    await tester.tap(find.text('Тревога и стресс'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-topic-format-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-format-chat')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-topic-continue')));
    await tester.pumpAndSettle();

    // 3. Экран поиска: счётчик онлайна показывает как минимум нашего эксперта.
    expect(find.byKey(const Key('sq-search-online-count')), findsOneWidget);

    // 4. Эксперт принимает оффер — клиент уезжает на «специалист найден».
    final consultationId = await expert.acceptOffer();
    for (var i = 0; i < 20 && find.text('Специалист найден!').evaluate().isEmpty; i++) {
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
    }
    expect(find.text('Специалист найден!'), findsOneWidget);

    // 5. Оплата: привязываем карту и холдируем.
    await tester.tap(find.byKey(const Key('sq-found-start')));
    await tester.pumpAndSettle();
    if (find.byKey(const Key('sq-payment-add-card')).evaluate().isNotEmpty &&
        find.text('Пока нет привязанных карт').evaluate().isNotEmpty) {
      await tester.tap(find.byKey(const Key('sq-payment-add-card')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('sq-card-number')),
        '4242424242424242',
      );
      await tester.enterText(find.byKey(const Key('sq-card-expiry')), '1229');
      await tester.enterText(
        find.byKey(const Key('sq-card-holder')),
        'IVAN IVANOV',
      );
      await tester.tap(find.byKey(const Key('sq-card-save')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('sq-found-start')));
      await tester.pumpAndSettle();
    }
    await tester.tap(find.byKey(const Key('sq-payment-pay')));
    await tester.pumpAndSettle();

    // 6. Чат: отправляем сообщение и ждём эха сервера.
    await tester.enterText(
      find.byKey(const Key('sq-chat-input')),
      'здравствуйте',
    );
    await tester.tap(find.byKey(const Key('sq-chat-send')));
    for (var i = 0; i < 20 && find.text('отправляется').evaluate().isNotEmpty; i++) {
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
    }
    expect(
      find.text('отправляется'),
      findsNothing,
      reason: 'эхо сервера должно снять статус «отправляется»',
    );

    // 7. Эксперт завершает консультацию -> клиент попадает на оценку.
    await expert.complete(consultationId);
    for (var i = 0; i < 20 && find.text('Как прошла консультация?').evaluate().isEmpty; i++) {
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
    }
    expect(find.text('Как прошла консультация?'), findsOneWidget);

    await tester.tap(find.byKey(const Key('sq-review-star-5')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-review-submit')));
    await tester.pumpAndSettle();

    // 8. История: консультация завершена и оплачена.
    await tester.tap(find.byKey(const Key('sq-nav-consultations')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('История'));
    await tester.pumpAndSettle();

    expect(find.text('Состоялась'), findsWidgets);
    expect(find.text('Оплачено'), findsWidgets);
  }, timeout: const Timeout(Duration(minutes: 5)));
}
