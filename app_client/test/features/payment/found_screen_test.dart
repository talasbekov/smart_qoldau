// Виджет-тесты экрана «специалист найден» (сверх минимума брифа — урок 1):
// карточка специалиста, переход к оплате и отказ от консультации.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/payment/ui/found_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

ExpertPublic _expert() => const ExpertPublic(
  id: 'e1',
  displayName: 'Динара С.',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  priceTiyn: 399000,
  languages: ['ru', 'kz'],
  formats: [SessionFormat.chat],
  topicSlugs: ['anxiety-stress'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.9,
  ratingCount: 312,
);

MatchRequest _matched() => MatchRequest(
  id: 'r1',
  status: RequestStatus.matched,
  isEmergency: false,
  clientCode: 4821,
  matchedExpert: _expert(),
  consultationId: 'c1',
);

ClientConsultation _consultation() => ClientConsultation(
  id: 'c1',
  status: ConsultationStatus.active,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: DateTime(2026, 8, 22, 10),
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: ConsultationPaymentStatus.unpaid,
  expert: _expert(),
);

Widget _wrap(SqApi api) {
  final router = GoRouter(
    initialLocation: RoutePaths.found('r1'),
    routes: [
      GoRoute(
        path: RoutePaths.foundPattern,
        builder: (context, state) =>
            FoundScreen(requestId: state.pathParameters['requestId']!),
      ),
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-home')),
      ),
      GoRoute(
        path: RoutePaths.sessionPattern,
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-session:${state.pathParameters['id']}'),
        ),
      ),
      GoRoute(
        path: RoutePaths.cardsAdd,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-add-card')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [sqApiProvider.overrideWithValue(api)],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(() => api.requestById('r1')).thenAnswer((_) async => _matched());
    when(() => api.consultationById('c1'))
        .thenAnswer((_) async => _consultation());
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
  });

  testWidgets('показывает карточку найденного специалиста', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Специалист найден!'), findsOneWidget);
    expect(find.text('Динара С.'), findsOneWidget);
    expect(find.text('312 отзывов'), findsOneWidget);
    expect(find.textContaining('Алматы'), findsOneWidget);
    expect(find.text('3\u00A0990\u00A0₸'), findsOneWidget);
  });

  testWidgets('«Начать консультацию» открывает шторку оплаты', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Начать консультацию'));
    await tester.pumpAndSettle();

    expect(find.text('Оплата консультации'), findsOneWidget);
    expect(find.text('Оплатить'), findsOneWidget);
  });

  testWidgets('успешный холд уводит в сессию консультации', (tester) async {
    when(() => api.payConsultation('c1', paymentMethodId: 'pm1'))
        .thenAnswer((_) async => const PayResult(status: PaymentStatus.held));

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Начать консультацию'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Оплатить'));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-session:c1'), findsOneWidget);
  });

  testWidgets('«Отменить консультацию» отменяет её и возвращает на главную', (
    tester,
  ) async {
    when(() => api.cancelConsultation('c1')).thenAnswer(
      (_) async => _consultation().copyWith(
        status: ConsultationStatus.cancelled,
        outcome: ConsultationOutcome.clientCancelled,
      ),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Отменить консультацию'));
    await tester.pumpAndSettle();

    verify(() => api.cancelConsultation('c1')).called(1);
    expect(find.text('sq-stub-home'), findsOneWidget);
  });

  testWidgets('сбой загрузки даёт SqErrorView с рабочим «Повторить»', (
    tester,
  ) async {
    var calls = 0;
    when(() => api.requestById('r1')).thenAnswer((_) async {
      calls++;
      if (calls == 1) {
        throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
      }
      return _matched();
    });

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Нет соединения с сервером'), findsOneWidget);

    await tester.tap(find.text('Повторить'));
    await tester.pumpAndSettle();

    expect(find.text('Динара С.'), findsOneWidget);
  });
}
