// Виджет-тесты скрининга экстренного сценария (Step 1 брифа задачи 11,
// БП-02 шаг 2) и экрана угрозы: «Да» уводит к телефонам служб и НЕ создаёт
// заявку, «Нет» создаёт экстренную заявку ровно один раз.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/core/url_launcher_port.dart';
import 'package:app_client/features/emergency/ui/danger_screen.dart';
import 'package:app_client/features/emergency/ui/screening_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

class _FakeUrlLauncherPort implements UrlLauncherPort {
  final List<String> launched = [];

  @override
  Future<void> launch(String url) async => launched.add(url);
}

MatchRequest _created() => const MatchRequest(
  id: 'r-emergency',
  status: RequestStatus.searching,
  isEmergency: true,
  clientCode: 7301,
);

Widget _wrap(SqApi api, {UrlLauncherPort? launcher}) {
  final router = GoRouter(
    initialLocation: RoutePaths.emergency,
    routes: [
      GoRoute(
        path: RoutePaths.emergency,
        builder: (context, state) => const ScreeningScreen(),
      ),
      GoRoute(
        path: RoutePaths.emergencyDanger,
        builder: (context, state) => const DangerScreen(),
      ),
      GoRoute(
        path: RoutePaths.searchPattern,
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-search:${state.pathParameters['requestId']}'),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      urlLauncherPortProvider.overrideWithValue(
        launcher ?? _FakeUrlLauncherPort(),
      ),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.chat));

  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).thenAnswer((_) async => _created());
  });

  testWidgets('«Да» уводит на экран угрозы и НЕ создаёт заявку', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    expect(find.text('Вам угрожает опасность прямо сейчас?'), findsOneWidget);

    await tester.tap(find.text('Да'));
    await tester.pumpAndSettle();

    expect(find.byType(DangerScreen), findsOneWidget);
    verifyNever(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    );
  });

  testWidgets('«Нет» создаёт экстренную заявку и уводит на поиск', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await tester.tap(find.text('Нет'));
    await tester.pumpAndSettle();

    verify(
      () => api.createRequest(
        topicSlug: 'other',
        format: SessionFormat.chat,
        isEmergency: true,
        expertId: null,
      ),
    ).called(1);
    expect(find.text('sq-stub-search:r-emergency'), findsOneWidget);
  });

  testWidgets('формат подбора можно сменить до ответа «Нет»', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await tester.tap(find.byKey(const Key('sq-emergency-format-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Аудио'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Нет'));
    await tester.pumpAndSettle();

    verify(
      () => api.createRequest(
        topicSlug: 'other',
        format: SessionFormat.audio,
        isEmergency: true,
        expertId: null,
      ),
    ).called(1);
  });

  testWidgets('двойной быстрый тап по «Нет» создаёт только одну заявку', (
    tester,
  ) async {
    // Урок 4 плана эпика: без guard'а два тапа подряд дают две заявки, из
    // которых вторая гарантированно упадёт с ACTIVE_REQUEST_EXISTS.
    //
    // Урок 3: гонку нельзя проверить, полагаясь на тайминг. `tester.tap`
    // сам по себе отдаёт управление циклу событий, и мок успевает
    // ответить — второй тап тогда происходит уже ПОСЛЕ завершения первого
    // и никакой гонки не воспроизводит. Затвор `Completer` держит первый
    // запрос в полёте ровно до второго тапа.
    final gate = Completer<void>();
    when(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).thenAnswer((_) async {
      await gate.future;
      return _created();
    });

    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await tester.tap(find.text('Нет'));
    await tester.tap(find.text('Нет'), warnIfMissed: false);
    gate.complete();
    await tester.pumpAndSettle();

    verify(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).called(1);
  });

  testWidgets('сбой создания заявки показывает ошибку и не блокирует кнопку', (
    tester,
  ) async {
    when(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).thenThrow(const ApiException(ApiErrorCode.network, 'нет сети', 0));

    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await tester.tap(find.text('Нет'));
    await tester.pumpAndSettle();

    expect(find.text('Нет соединения с сервером'), findsOneWidget);
    expect(find.text('Нет'), findsOneWidget);
  });

  group('DangerScreen', () {
    testWidgets('кнопки служб звонят по tel:102 и tel:103', (tester) async {
      final launcher = _FakeUrlLauncherPort();
      await tester.pumpWidget(_wrap(api, launcher: launcher));
      await tester.pump();
      await tester.tap(find.text('Да'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Позвонить 102'));
      await tester.pump();
      await tester.tap(find.text('Позвонить 103'));
      await tester.pump();

      expect(launcher.launched, ['tel:102', 'tel:103']);
    });

    testWidgets('«не угрожает опасность» продолжает приоритетный подбор', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(api));
      await tester.pump();
      await tester.tap(find.text('Да'));
      await tester.pumpAndSettle();

      await tester.tap(
        find.text('Мне не угрожает опасность, продолжить подбор'),
      );
      await tester.pumpAndSettle();

      verify(
        () => api.createRequest(
          topicSlug: 'other',
          format: SessionFormat.chat,
          isEmergency: true,
          expertId: null,
        ),
      ).called(1);
      expect(find.text('sq-stub-search:r-emergency'), findsOneWidget);
    });
  });
}
