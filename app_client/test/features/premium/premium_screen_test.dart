// Виджет-тесты экрана Premium (E12, задача 8): тарифы, оформление,
// отмена, объяснение отказа банка.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/features/premium/ui/premium_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

PaymentMethod _card() => const PaymentMethod(
  id: 'pm-1',
  maskedPan: '**** 1111',
  brand: 'VISA',
  holderName: 'I IVANOV',
);

PremiumStatus _active({bool cancelled = false}) => PremiumStatus(
  active: true,
  cancelled: cancelled,
  inGrace: false,
  plan: PremiumPlan.month,
  currentPeriodEnd: DateTime.utc(2026, 9, 26),
);

Widget _wrap(SqApi api) => ProviderScope(
  overrides: [sqApiProvider.overrideWithValue(api)],
  child: const MaterialApp(
    locale: Locale('ru'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: PremiumScreen(),
  ),
);

void main() {
  late MockSqApi api;

  setUpAll(() => registerFallbackValue(PremiumPlan.month));

  setUp(() {
    api = MockSqApi();
    when(() => api.paymentMethods()).thenAnswer((_) async => [_card()]);
    // По умолчанию справочник тарифов недоступен: проверяем, что экран
    // это переживает, а отдельный тест ниже — что цена приходит из API.
    when(() => api.premiumPlans()).thenThrow(Exception('нет связи'));
  });

  testWidgets('цена берётся из API, а не из зашитой копии', (tester) async {
    when(() => api.premiumStatus()).thenAnswer((_) async => PremiumStatus.none);
    when(() => api.premiumPlans()).thenAnswer(
      (_) async => const PremiumPlans(
        prices: {PremiumPlan.month: 777000, PremiumPlan.year: 5000000},
        discountPercent: 10,
      ),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    // Смена цены на бэкенде должна доезжать до людей без релиза в
    // маркетах — ради этого справочник и заведён.
    expect(find.textContaining('7\u00A0770'), findsOneWidget);
    expect(find.textContaining('4\u00A0990'), findsNothing);
  });

  testWidgets('если справочник тарифов не ответил, цена всё равно видна', (
    tester,
  ) async {
    when(() => api.premiumStatus()).thenAnswer((_) async => PremiumStatus.none);

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    // Пустое место вместо суммы хуже слегка устаревшей суммы.
    expect(find.textContaining('4\u00A0990'), findsOneWidget);
  });

  testWidgets('показывает оба тарифа и оформляет выбранный', (
    tester,
  ) async {
    when(() => api.premiumStatus()).thenAnswer((_) async => PremiumStatus.none);
    when(
      () => api.subscribePremium(
        plan: any(named: 'plan'),
        paymentMethodId: any(named: 'paymentMethodId'),
      ),
    ).thenAnswer((_) async => _active());

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.textContaining('4\u00A0990'), findsOneWidget);
    expect(find.textContaining('39\u00A0900'), findsOneWidget);

    await tester.tap(find.byKey(const Key('sq-premium-plan-year')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('sq-premium-subscribe')));
    await tester.pumpAndSettle();

    verify(
      () =>
          api.subscribePremium(plan: PremiumPlan.year, paymentMethodId: 'pm-1'),
    ).called(1);
  });

  testWidgets('402 PAYMENT_DECLINED объясняется словами приложения', (
    tester,
  ) async {
    when(() => api.premiumStatus()).thenAnswer((_) async => PremiumStatus.none);
    when(
      () => api.subscribePremium(
        plan: any(named: 'plan'),
        paymentMethodId: any(named: 'paymentMethodId'),
      ),
    ).thenThrow(
      const ApiException(
        ApiErrorCode.paymentDeclined,
        'Банк отклонил оплату',
        402,
      ),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-premium-subscribe')));
    await tester.pumpAndSettle();

    expect(find.textContaining('отклонён'), findsWidgets);
  });

  testWidgets('активная подписка: видно дату окончания и кнопку отмены', (
    tester,
  ) async {
    when(() => api.premiumStatus()).thenAnswer((_) async => _active());
    when(() => api.cancelPremium())
        .thenAnswer((_) async => _active(cancelled: true));

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.textContaining('26'), findsWidgets);
    expect(find.byKey(const Key('sq-premium-cancel')), findsOneWidget);
    expect(find.byKey(const Key('sq-premium-subscribe')), findsNothing);

    await tester.tap(find.byKey(const Key('sq-premium-cancel')));
    await tester.pumpAndSettle();
    verify(() => api.cancelPremium()).called(1);
  });

  testWidgets('без привязанной карты оформить нельзя — ведём добавить карту', (
    tester,
  ) async {
    when(() => api.premiumStatus()).thenAnswer((_) async => PremiumStatus.none);
    when(() => api.paymentMethods()).thenAnswer((_) async => []);

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('sq-premium-add-card')), findsOneWidget);
    expect(find.byKey(const Key('sq-premium-subscribe')), findsNothing);
  });

  testWidgets('на экране 411 dp ничего не переполняется', (tester) async {
    when(() => api.premiumStatus()).thenAnswer((_) async => PremiumStatus.none);
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
