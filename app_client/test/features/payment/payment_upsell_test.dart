// Апселл Premium в шторке оплаты (E12, задача 9): базовому клиенту —
// предложение со скидкой, подписчику — отметка, что скидка уже применена.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/payment/ui/payment_sheet.dart';
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
    initialLocation: '/host',
    routes: [
      GoRoute(
        path: '/host',
        builder: (context, state) =>
            Scaffold(body: PaymentSheet(consultation: _consultation())),
      ),
      GoRoute(
        path: RoutePaths.premium,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-premium')),
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
    when(() => api.paymentMethods()).thenAnswer(
      (_) async => const [
        PaymentMethod(
          id: 'pm-1',
          maskedPan: '**** 1111',
          brand: 'VISA',
          holderName: 'I IVANOV',
        ),
      ],
    );
  });

  testWidgets('базовый клиент видит апселл со скидкой 10 %', (tester) async {
    when(() => api.premiumStatus()).thenAnswer((_) async => PremiumStatus.none);

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.textContaining('10 %'), findsOneWidget);

    await tester.tap(find.byKey(const Key('sq-payment-premium-upsell')));
    await tester.pumpAndSettle();
    expect(find.text('sq-stub-premium'), findsOneWidget);
  });

  testWidgets('у Premium-клиента апселла нет, скидка уже применена', (
    tester,
  ) async {
    when(() => api.premiumStatus()).thenAnswer(
      (_) async => PremiumStatus(
        active: true,
        cancelled: false,
        inGrace: false,
        plan: PremiumPlan.month,
        currentPeriodEnd: DateTime.utc(2026, 9, 26),
      ),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('sq-payment-premium-upsell')), findsNothing);
    expect(find.textContaining('Скидка Premium'), findsOneWidget);
  });

  testWidgets('статус не загрузился — шторка оплаты работает без апселла', (
    tester,
  ) async {
    when(() => api.premiumStatus()).thenThrow(
      const ApiException(ApiErrorCode.network, 'нет сети', 0),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    // Оплата не должна зависеть от того, ответил ли эндпоинт подписки.
    expect(find.byKey(const Key('sq-payment-premium-upsell')), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
