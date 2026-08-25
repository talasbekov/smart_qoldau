// Виджет-тесты шторки оплаты (Step 2 брифа задачи 12): сумма и длительность,
// поведение без карт, успешный холд и отказ провайдера.
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

PaymentMethod _card(String id, String pan) =>
    PaymentMethod(id: id, maskedPan: pan, brand: 'VISA', holderName: 'I IVANOV');

Widget _wrap(SqApi api) {
  final router = GoRouter(
    initialLocation: '/host',
    routes: [
      GoRoute(
        path: '/host',
        builder: (context, state) => Scaffold(
          body: PaymentSheet(consultation: _consultation()),
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
    when(() => api.paymentMethods()).thenAnswer(
      (_) async => [_card('pm1', '**** 4242'), _card('pm2', '**** 1111')],
    );
  });

  testWidgets('показывает длительность, сумму и пояснение эскроу', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Консультация'), findsOneWidget);
    expect(find.text('50 минут'), findsOneWidget);
    expect(find.text('3\u00A0990\u00A0₸'), findsOneWidget);
    expect(
      find.text(
        'Деньги замораживаются на карте и списываются только после '
        'состоявшейся консультации',
      ),
      findsOneWidget,
    );
  });

  testWidgets('без карт «Оплатить» заблокирована, видна «Добавить карту»', (
    tester,
  ) async {
    when(() => api.paymentMethods()).thenAnswer((_) async => []);

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Пока нет привязанных карт'), findsOneWidget);
    expect(find.text('Добавить карту'), findsOneWidget);

    await tester.tap(find.text('Оплатить'));
    await tester.pumpAndSettle();

    verifyNever(
      () => api.payConsultation(any(), paymentMethodId: any(named: 'paymentMethodId')),
    );
  });

  testWidgets('оплата холдирует деньги первой картой и закрывает шторку', (
    tester,
  ) async {
    when(
      () => api.payConsultation('c1', paymentMethodId: 'pm1'),
    ).thenAnswer((_) async => const PayResult(status: PaymentStatus.held));

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Оплатить'));
    await tester.pumpAndSettle();

    verify(() => api.payConsultation('c1', paymentMethodId: 'pm1')).called(1);
  });

  testWidgets('вторая карта выбирается тапом и уходит в оплату', (
    tester,
  ) async {
    when(
      () => api.payConsultation('c1', paymentMethodId: 'pm2'),
    ).thenAnswer((_) async => const PayResult(status: PaymentStatus.held));

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('**** 1111'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Оплатить'));
    await tester.pumpAndSettle();

    verify(() => api.payConsultation('c1', paymentMethodId: 'pm2')).called(1);
  });

  testWidgets('отказ провайдера показывает его текст и не закрывает шторку', (
    tester,
  ) async {
    when(() => api.payConsultation('c1', paymentMethodId: 'pm1')).thenThrow(
      const ApiException(
        ApiErrorCode.providerDeclined,
        'Недостаточно средств',
        402,
      ),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Оплатить'));
    await tester.pumpAndSettle();

    expect(find.text('Платёж отклонён'), findsOneWidget);
    expect(find.text('Недостаточно средств'), findsOneWidget);
    expect(find.text('Повторить'), findsOneWidget);
    expect(find.text('Другая карта'), findsOneWidget);
  });

  testWidgets('«Добавить карту» уводит на экран новой карты', (tester) async {
    when(() => api.paymentMethods()).thenAnswer((_) async => []);

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Добавить карту'));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-add-card'), findsOneWidget);
  });
}
