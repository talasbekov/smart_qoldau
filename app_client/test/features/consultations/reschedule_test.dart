// Перенос плановой консультации (E6b, задача 9): тот же выбор слота, но
// без шторки оплаты — холд уже стоит.
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

final _now = DateTime.utc(2026, 8, 24, 3);

Future<Widget> _wrap(SqApi api) async {
  final router = GoRouter(
    initialLocation: '/reschedule',
    routes: [
      GoRoute(
        path: '/reschedule',
        builder: (context, state) => const SlotPickerScreen(
          expertId: 'e1',
          topicSlug: 'anxiety-stress',
          format: SessionFormat.chat,
          consultationId: 'c1',
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
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(
      () => api.slots('e1', from: any(named: 'from'), to: any(named: 'to')),
    ).thenAnswer(
      (_) async => [Slot(startAt: DateTime.utc(2026, 8, 24, 5))],
    );
    when(() => api.paymentMethods()).thenAnswer((_) async => []);
    when(() => api.reschedule(any(), any())).thenAnswer(
      (_) async => BookingResult(
        consultationId: 'c1',
        startedAt: DateTime.utc(2026, 8, 24, 5),
        status: ConsultationStatus.scheduled,
        paymentStatus: ConsultationPaymentStatus.held,
      ),
    );
  });

  testWidgets('выбор слота переносит запись, шторка оплаты не открывается', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Перенос консультации'), findsOneWidget);

    await tester.tap(find.text('10:00'));
    await tester.pumpAndSettle();

    verify(
      () => api.reschedule('c1', DateTime.utc(2026, 8, 24, 5)),
    ).called(1);
    // Холд уже стоит — карту не спрашиваем.
    verifyNever(() => api.paymentMethods());
    expect(find.text('sq-stub-consultations'), findsOneWidget);
  });

  testWidgets('SLOT_TAKEN оставляет на экране и показывает сообщение', (
    tester,
  ) async {
    when(() => api.reschedule(any(), any())).thenAnswer(
      (_) async => throw const ApiException('SLOT_TAKEN', 'занято', 409),
    );

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('10:00'));
    await tester.pumpAndSettle();

    expect(find.text('Это время только что заняли'), findsOneWidget);
    expect(find.text('sq-stub-consultations'), findsNothing);
  });
}
