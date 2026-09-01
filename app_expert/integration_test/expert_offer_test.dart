// Сквозной прогон приложения эксперта против ЖИВОГО бэкенда (Step 2
// брифа задачи 17 эпика E7).
//
// Что проверяется одним сценарием: вход по телефону -> анкета онбординга
// (без документов — верификация подставляется напрямую, это операция
// админки вне объёма E7) -> статус верификации дожидается VERIFIED ->
// главный экран, приём заявок включён -> доход/отзывы открываются без
// ошибок -> клиент (прямой HTTP внутри теста) создаёт НАПРАВЛЕННУЮ заявку
// на нашего эксперта -> offer.new по WS поднимает полноэкранный алерт ->
// «Принять» -> сессия чата -> обмен сообщением с эхом сервера -> исход
// COMPLETED.
//
// Запуск (нужны поднятый бэкенд И dev-инфра):
//   docker compose -f infra/docker-compose.dev.yml up -d postgres redis minio
//   cd backend && npm run start:dev > /tmp/backend-dev.log 2>&1 &
//   cd app_expert && flutter test integration_test/expert_offer_test.dart \
//     -d linux --dart-define=API_BASE_URL=http://localhost:3000/v1 \
//     --dart-define=WS_BASE_URL=http://localhost:3000 \
//     --dart-define=BACKEND_LOG=/tmp/backend-dev.log
//
// SMS-код в dev-режиме НЕ фиксирован (`SmsDevProvider` логирует настоящий
// случайный 4-значный код, см. `AuthService.requestCode`) — тест читает
// его из файла лога бэкенда (`--dart-define=BACKEND_LOG`), в который нужно
// перенаправить stdout процесса `npm run start:dev` (см. команду запуска
// выше). Это делает тест локальным по конструкции — тот же компромисс, что
// уже принят `app_client/integration_test/funnel_test.dart` (не собирается
// для CI, только для ручного прогона).
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_expert/app.dart';
import 'package:app_expert/core/locale_controller.dart';
import 'package:app_expert/core/providers.dart';
import 'package:app_expert/features/home/state/home_controller.dart';
import 'package:app_expert/features/offers/state/incoming_offer_controller.dart';

// `WS_BASE_URL` не читается здесь напрямую — его читает `buildSqEvents`
// (`core/providers.dart`) при подключении WS уже внутри приложения; тест
// передаёт его только через `--dart-define`, тем же флагом.
const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000/v1',
);

/// Файл, в который перенаправлен stdout `npm run start:dev` — оттуда
/// вычитывается настоящий dev-SMS-код (см. докстринг файла).
const _backendLog = String.fromEnvironment(
  'BACKEND_LOG',
  defaultValue: '/tmp/backend-dev.log',
);

/// 9 цифр после фиксированного префикса `+7 (7` — тот же формат маски,
/// что `PhoneScreen._typedDigitsCount`. Уникальны на запуск: фиксированный
/// номер конфликтовал бы с экспертом, заведённым предыдущим прогоном
/// (`POST /experts` повторно для того же пользователя отвечает
/// `EXPERT_EXISTS`).
String _typedDigits() {
  final n = DateTime.now().millisecondsSinceEpoch % 900000000 + 100000000;
  return n.toString();
}

/// Достаёт последний SMS-код для [phone] из лога dev-провайдера
/// (`SmsDevProvider`: `SMS -> {phone}: SmartQoldau: код входа {code}`).
/// Опрашивает файл — процесс бэкенда пишет лог асинхронно.
Future<String> _readSmsCode(String phone) async {
  final pattern = RegExp('SMS -> ${RegExp.escape(phone)}: .*код входа (\\d{6})');
  for (var attempt = 0; attempt < 20; attempt++) {
    final file = File(_backendLog);
    if (file.existsSync()) {
      final lines = file.readAsLinesSync();
      for (final line in lines.reversed) {
        final match = pattern.firstMatch(line);
        if (match != null) return match.group(1)!;
      }
    }
    await Future<void>.delayed(const Duration(milliseconds: 500));
  }
  fail('SMS-код для $phone не найден в $_backendLog за 10 секунд');
}

/// Клиентская сторона консультации — прямой HTTP-клиент внутри теста
/// (клиентского приложения в этом сценарии нет, роль играет `Dio`, тот же
/// приём, что `_ExpertSide` в `app_client/integration_test/funnel_test
/// .dart`, только наоборот).
class _ClientSide {
  _ClientSide() : _dio = Dio(BaseOptions(baseUrl: _apiBaseUrl));

  final Dio _dio;
  String? _token;

  Options get _auth => Options(headers: {'Authorization': 'Bearer $_token'});

  Future<void> signInAsGuest() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/guest',
      data: {
        'deviceId': 'integration-test-client-${DateTime.now().millisecondsSinceEpoch}',
      },
    );
    _token = response.data!['accessToken'] as String;
  }

  /// Направленная заявка конкретному эксперту — без direct-таргетинга
  /// пришлось бы полагаться на матчинг по теме/офлайн-очереди, что не
  /// нужно этому сценарию (он не про матчинг, он про офферы/сессию).
  Future<void> requestExpert(String expertId, {required String topicSlug}) =>
      _dio.post<void>(
        '/requests',
        data: {'topicSlug': topicSlug, 'format': 'chat', 'expertId': expertId},
        options: _auth,
      );
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'эксперт: вход -> анкета -> верификация -> оффер -> чат -> исход',
    (tester) async {
      final digits = _typedDigits();
      final phone = '+77$digits';

      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();

      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          sqApiProvider.overrideWith(buildSqApi),
          sqEventsProvider.overrideWith(buildSqEvents),
        ],
      );
      addTearDown(container.dispose);
      container.listen(incomingOfferControllerProvider, (previous, next) {});

      await tester.pumpWidget(
        UncontrolledProviderScope(container: container, child: const SqExpertApp()),
      );
      await tester.pumpAndSettle();

      // 1. Вход по телефону.
      await tester.enterText(find.byType(TextField).first, digits);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('sq-phone-submit')));
      await tester.pumpAndSettle();

      final code = await _readSmsCode(phone);
      final cells = find.byType(TextField);
      for (var i = 0; i < code.length; i++) {
        await tester.enterText(cells.at(i), code[i]);
        await tester.pump();
      }
      await tester.pumpAndSettle();

      // 2. Свежий телефон без анкеты — HomeScreen уводит на онбординг
      // (см. фикс этой же задачи 17: EXPERT_NOT_FOUND -> /onboarding/profile).
      for (
        var i = 0;
        i < 10 && find.byKey(const Key('sq-onboarding-display-name')).evaluate().isEmpty;
        i++
      ) {
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();
      }
      expect(find.byKey(const Key('sq-onboarding-display-name')), findsOneWidget);

      // 3. Анкета шаг 1/2: только обязательные поля.
      await tester.enterText(
        find.byKey(const Key('sq-onboarding-display-name')),
        'Интеграционный Э.',
      );
      await tester.enterText(find.byKey(const Key('sq-onboarding-education')), 'КазНУ');
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('sq-onboarding-next')));
      await tester.pumpAndSettle();

      // 4. Анкета шаг 2/2: тема — по ключу (не по локализованному тексту).
      const topicSlug = 'anxiety-stress';
      await tester.tap(find.byKey(const Key('sq-onboarding-topic-$topicSlug')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('sq-onboarding-submit')));
      await tester.pumpAndSettle();

      // 5. Статус верификации: подставляем VERIFIED напрямую (сид-скрипт,
      // не через UI — верификация вне объёма E7).
      final verify = await Process.run(
        'npm',
        ['run', 'expert:verify', '--', '--phone=$phone'],
        workingDirectory: '../backend',
      );
      expect(verify.exitCode, 0, reason: 'expert:verify упал: ${verify.stdout}\n${verify.stderr}');

      // Страховочный опрос — раз в 30с (см. VerificationStatusController).
      for (
        var i = 0;
        i < 40 && find.byKey(const Key('sq-home-accepting-switch')).evaluate().isEmpty;
        i++
      ) {
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();
      }
      expect(
        find.byKey(const Key('sq-home-accepting-switch')),
        findsOneWidget,
        reason: 'не дождались перехода на главный экран после VERIFIED',
      );

      // 6. Включаем приём заявок.
      await tester.tap(find.byKey(const Key('sq-home-accepting-switch')));
      await tester.pumpAndSettle();

      // 7. Доход и отзывы открываются без ошибок (свежий эксперт — пустые
      // состояния, не крэш и не 500-й).
      await tester.tap(find.byKey(const Key('sq-home-earnings')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('sq-earnings-payout')), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('sq-home-reviews')));
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();

      // 8. Клиент создаёт направленную заявку нашему эксперту.
      final expertId = container.read(homeControllerProvider).value!.id;
      final client = _ClientSide();
      await client.signInAsGuest();
      await client.requestExpert(expertId, topicSlug: topicSlug);

      // 9. Полноэкранный алерт оффера появляется через WS -> «Принять».
      for (
        var i = 0;
        i < 20 && find.byKey(const Key('sq-offer-accept')).evaluate().isEmpty;
        i++
      ) {
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();
      }
      expect(find.byKey(const Key('sq-offer-accept')), findsOneWidget);
      await tester.tap(find.byKey(const Key('sq-offer-accept')));
      await tester.pumpAndSettle();

      // 10. Сессия чата: сообщение появляется только эхом сервера.
      for (
        var i = 0;
        i < 20 && find.byKey(const Key('sq-chat-input')).evaluate().isEmpty;
        i++
      ) {
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();
      }
      expect(find.byKey(const Key('sq-chat-input')), findsOneWidget);

      await tester.enterText(find.byKey(const Key('sq-chat-input')), 'здравствуйте');
      await tester.tap(find.byKey(const Key('sq-chat-send')));
      await tester.pumpAndSettle();

      for (var i = 0; i < 20 && find.text('здравствуйте').evaluate().isEmpty; i++) {
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();
      }
      expect(
        find.text('здравствуйте'),
        findsOneWidget,
        reason: 'эхо сервера должно вернуть отправленное сообщение',
      );

      // 11. Исход — COMPLETED.
      await tester.tap(find.byKey(const Key('sq-session-complete')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('sq-outcome-COMPLETED')));
      await tester.pumpAndSettle();
    },
    timeout: const Timeout(Duration(minutes: 5)),
  );
}
