// Экран выбора слота (E6b, задача 8): время по Алматы с явной пометкой
// зоны, запись через шторку выбора карты, обработка «слот заняли».
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/booking/ui/slot_picker_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

final _now = DateTime.utc(2026, 8, 24, 3); // 08:00 Алматы

PaymentMethod _card() => const PaymentMethod(
  id: 'card-1',
  maskedPan: '**** 4521',
  brand: 'visa',
  holderName: 'Ivan Petrov',
);

Future<Widget> _wrap(SqApi api) async {
  final router = GoRouter(
    initialLocation: '/booking',
    routes: [
      GoRoute(
        path: '/booking',
        builder: (context, state) => const SlotPickerScreen(
          expertId: 'e1',
          topicSlug: 'anxiety-stress',
          format: SessionFormat.chat,
        ),
      ),
      GoRoute(
        path: RoutePaths.consultations,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-consultations')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      nowProvider.overrideWithValue(() => _now),
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
      () => api.slots('e1', from: any(named: 'from'), to: any(named: 'to')),
    ).thenAnswer(
      (_) async => [
        Slot(startAt: DateTime.utc(2026, 8, 24, 5)), // 10:00 Алматы
        Slot(startAt: DateTime.utc(2026, 8, 24, 6)), // 11:00 Алматы
      ],
    );
    when(() => api.paymentMethods()).thenAnswer((_) async => [_card()]);
    when(
      () => api.createBooking(
        expertId: any(named: 'expertId'),
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        slotStartAt: any(named: 'slotStartAt'),
        paymentMethodId: any(named: 'paymentMethodId'),
      ),
    ).thenAnswer(
      (_) async => BookingResult(
        consultationId: 'c1',
        startedAt: DateTime.utc(2026, 8, 24, 5),
        status: ConsultationStatus.scheduled,
        paymentStatus: ConsultationPaymentStatus.held,
      ),
    );
  });

  testWidgets('слоты показаны по Алматы и зона названа явно', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Время указано по Алматы'), findsOneWidget);
    expect(find.text('10:00'), findsOneWidget);
    expect(find.text('11:00'), findsOneWidget);
    // 05:00 UTC наружу не просачивается.
    expect(find.text('05:00'), findsNothing);
  });

  testWidgets('выбор слота и карты создаёт запись и уводит в консультации', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('10:00'));
    await tester.pumpAndSettle();

    // Шторка выбора карты.
    expect(find.text('**** 4521'), findsOneWidget);
    await tester.tap(find.byKey(const Key('sq-booking-confirm')));
    await tester.pumpAndSettle();

    final captured = verify(
      () => api.createBooking(
        expertId: 'e1',
        topicSlug: 'anxiety-stress',
        format: SessionFormat.chat,
        slotStartAt: captureAny(named: 'slotStartAt'),
        paymentMethodId: 'card-1',
      ),
    ).captured.single as DateTime;
    expect(captured.toUtc(), DateTime.utc(2026, 8, 24, 5));

    expect(find.text('sq-stub-consultations'), findsOneWidget);
  });

  testWidgets('SLOT_TAKEN показывает сообщение и перезагружает слоты', (
    tester,
  ) async {
    when(
      () => api.createBooking(
        expertId: any(named: 'expertId'),
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        slotStartAt: any(named: 'slotStartAt'),
        paymentMethodId: any(named: 'paymentMethodId'),
      ),
    ).thenAnswer(
      (_) async => throw const ApiException('SLOT_TAKEN', 'занято', 409),
    );

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('10:00'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-booking-confirm')));
    await tester.pumpAndSettle();

    expect(find.text('Это время только что заняли'), findsOneWidget);
    // Слоты перезапрошены — выдача устарела.
    verify(
      () => api.slots('e1', from: any(named: 'from'), to: any(named: 'to')),
    ).called(2);
    // Пользователь остался на экране выбора.
    expect(find.text('sq-stub-consultations'), findsNothing);
  });
}
