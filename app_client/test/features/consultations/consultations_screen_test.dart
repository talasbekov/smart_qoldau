// Виджет-тесты раздела консультаций (Step 2 брифа задачи 17): вкладки,
// пустые состояния, статусы оплаты, отмена с подтверждением и детали с
// маской карты.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/core/providers.dart';
import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/consultations/ui/consultation_details_screen.dart';
import 'package:app_client/features/consultations/ui/consultations_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

class _FakeSqSocket implements SqSocket {
  final _events = StreamController<(String, dynamic)>.broadcast();

  @override
  Stream<(String, dynamic)> get events => _events.stream;

  @override
  Stream<SqConnectionState> get connectionState => const Stream.empty();

  @override
  void emit(String event, dynamic data) {}

  @override
  Future<void> connect(String token) async {}

  @override
  Future<void> disconnect() async {}

  Future<void> dispose() => _events.close();
}

ExpertPublic _expert() => const ExpertPublic(
  id: 'e1',
  displayName: 'Динара С.',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  priceTiyn: 399000,
  languages: ['ru'],
  formats: [SessionFormat.chat],
  topicSlugs: ['anxiety-stress'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.9,
  ratingCount: 312,
);

ClientConsultation _consultation({
  String id = 'c1',
  ConsultationStatus status = ConsultationStatus.active,
  ConsultationPaymentStatus payment = ConsultationPaymentStatus.held,
  ConsultationOutcome? outcome,
}) => ClientConsultation(
  id: id,
  status: status,
  outcome: outcome,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: DateTime(2026, 8, 22, 10),
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: payment,
  expert: _expert(),
);

Future<Widget> _wrap(
  SqApi api, {
  SqSocket? socket,
  String initialLocation = RoutePaths.consultations,
  Map<String, Object> prefsValues = const {},
}) async {
  SharedPreferences.setMockInitialValues(prefsValues);
  final prefs = await SharedPreferences.getInstance();

  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: RoutePaths.consultations,
        builder: (context, state) => const ConsultationsScreen(),
      ),
      GoRoute(
        path: RoutePaths.consultationDetailsPattern,
        builder: (context, state) =>
            ConsultationDetailsScreen(consultationId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: RoutePaths.sessionPattern,
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-session:${state.pathParameters['id']}'),
        ),
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
      sqEventsProvider.overrideWithValue(SqEvents(socket ?? _FakeSqSocket())),
      sharedPreferencesProvider.overrideWithValue(prefs),
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
  setUpAll(() {
    registerFallbackValue(ConsultationStatus.active);
    registerFallbackValue(SessionFormat.chat);
  });

  late MockSqApi api;
  late _FakeSqSocket socket;

  setUp(() {
    api = MockSqApi();
    socket = _FakeSqSocket();
    addTearDown(socket.dispose);
    when(
      () => api.consultations(
        status: any(named: 'status'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => []);
  });

  testWidgets('пустые вкладки показывают свои состояния', (tester) async {
    await tester.pumpWidget(await _wrap(api, socket: socket));
    await tester.pumpAndSettle();

    expect(find.text('Активных консультаций нет'), findsOneWidget);

    await tester.tap(find.text('История'));
    await tester.pumpAndSettle();

    expect(find.text('История пока пуста'), findsOneWidget);
  });

  testWidgets('активная консультация ведёт в сессию по «Продолжить»', (
    tester,
  ) async {
    when(
      () => api.consultations(
        status: ConsultationStatus.active,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => [_consultation()]);

    await tester.pumpWidget(await _wrap(api, socket: socket));
    await tester.pumpAndSettle();

    expect(find.text('Динара С.'), findsOneWidget);
    expect(find.text('Деньги заморожены'), findsOneWidget);

    await tester.tap(find.text('Продолжить'));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-session:c1'), findsOneWidget);
  });

  testWidgets('неоплаченная консультация предлагает оплатить', (tester) async {
    when(
      () => api.consultations(
        status: ConsultationStatus.active,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer(
      (_) async => [_consultation(payment: ConsultationPaymentStatus.unpaid)],
    );
    when(() => api.paymentMethods()).thenAnswer(
      (_) async => const [
        PaymentMethod(
          id: 'pm1',
          maskedPan: '**** 4242',
          brand: 'VISA',
          holderName: 'I IVANOV',
        ),
      ],
    );

    await tester.pumpWidget(await _wrap(api, socket: socket));
    await tester.pumpAndSettle();

    expect(find.text('Ожидает оплаты'), findsOneWidget);

    await tester.tap(find.text('Оплатить'));
    await tester.pumpAndSettle();

    expect(find.text('Оплата консультации'), findsOneWidget);
  });

  testWidgets('отмена спрашивает подтверждение с текстом БП-03', (
    tester,
  ) async {
    when(
      () => api.consultations(
        status: ConsultationStatus.active,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => [_consultation()]);
    when(
      () => api.cancelConsultation('c1'),
    ).thenAnswer((_) async => _consultation(status: ConsultationStatus.cancelled));

    await tester.pumpWidget(await _wrap(api, socket: socket));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Отменить'));
    await tester.pumpAndSettle();

    expect(
      find.text('Время освободится для другого пользователя'),
      findsOneWidget,
    );

    await tester.tap(find.text('Отменить консультацию'));
    await tester.pumpAndSettle();

    verify(() => api.cancelConsultation('c1')).called(1);
  });

  testWidgets('история показывает исход и «Повторить запись»', (tester) async {
    when(
      () => api.consultations(
        status: ConsultationStatus.completed,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer(
      (_) async => [
        _consultation(
          status: ConsultationStatus.completed,
          outcome: ConsultationOutcome.completed,
          payment: ConsultationPaymentStatus.captured,
        ),
      ],
    );

    await tester.pumpWidget(await _wrap(api, socket: socket));
    await tester.pumpAndSettle();
    await tester.tap(find.text('История'));
    await tester.pumpAndSettle();

    expect(find.text('Состоялась'), findsOneWidget);
    expect(find.text('Оплачено'), findsOneWidget);
    expect(find.text('Повторить запись'), findsOneWidget);
  });

  group('детали консультации', () {
    setUp(() {
      when(
        () => api.consultationById('c1'),
      ).thenAnswer((_) async => _consultation(
        status: ConsultationStatus.completed,
        payment: ConsultationPaymentStatus.captured,
        outcome: ConsultationOutcome.completed,
      ));
    });

    testWidgets('показывает карту, которой оплачено', (tester) async {
      when(() => api.consultationPayment('c1')).thenAnswer(
        (_) async => const PaymentStatusInfo(
          status: PaymentStatus.captured,
          amountTiyn: 399000,
          maskedPan: '**** 1234',
        ),
      );

      await tester.pumpWidget(
        await _wrap(
          api,
          socket: socket,
          initialLocation: RoutePaths.consultationDetails('c1'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Оплачено картой **** 1234'), findsOneWidget);
    });

    testWidgets('без платежа (404) блок карты просто не рисуется', (
      tester,
    ) async {
      when(() => api.consultationPayment('c1')).thenAnswer(
        (_) async => throw const ApiException(
          ApiErrorCode.paymentNotFound,
          'not found',
          404,
        ),
      );

      await tester.pumpWidget(
        await _wrap(
          api,
          socket: socket,
          initialLocation: RoutePaths.consultationDetails('c1'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Оплачено картой'), findsNothing);
      expect(find.text('Динара С.'), findsOneWidget);
    });

    testWidgets('свой отзыв можно удалить с подтверждением', (tester) async {
      when(() => api.consultationPayment('c1')).thenAnswer(
        (_) async => throw const ApiException(
          ApiErrorCode.paymentNotFound,
          'not found',
          404,
        ),
      );
      when(() => api.deleteReview('rev-1')).thenAnswer((_) async {});

      await tester.pumpWidget(
        await _wrap(
          api,
          socket: socket,
          initialLocation: RoutePaths.consultationDetails('c1'),
          prefsValues: {'sq.reviewed.c1': true, 'sq.reviewId.c1': 'rev-1'},
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Удалить отзыв'));
      await tester.pumpAndSettle();

      expect(
        find.text('Рейтинг специалиста будет пересчитан'),
        findsOneWidget,
      );

      await tester.tap(find.text('Удалить отзыв').last);
      await tester.pumpAndSettle();

      verify(() => api.deleteReview('rev-1')).called(1);
      expect(find.text('Удалить отзыв'), findsNothing);
    });

    testWidgets('без сохранённого отзыва кнопки удаления нет', (tester) async {
      when(() => api.consultationPayment('c1')).thenAnswer(
        (_) async => throw const ApiException(
          ApiErrorCode.paymentNotFound,
          'not found',
          404,
        ),
      );

      await tester.pumpWidget(
        await _wrap(
          api,
          socket: socket,
          initialLocation: RoutePaths.consultationDetails('c1'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Удалить отзыв'), findsNothing);
    });
  });
}
