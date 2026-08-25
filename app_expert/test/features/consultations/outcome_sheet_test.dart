// Виджет-тесты OutcomeSheet (Step 1 брифа задачи 13 эпика E7): выбор исхода
// вызывает completeConsultation и закрывает шторку с результатом; сбой сети
// показывает ошибку прямо в шторке, не закрывая её.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/consultations/ui/outcome_sheet.dart';
import 'package:app_expert/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

ConsultationExpertDto _consultation(ConsultationOutcome outcome) => ConsultationExpertDto(
  id: 'cons-1',
  status: ConsultationStatus.completed,
  outcome: outcome,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: DateTime.now().subtract(const Duration(minutes: 30)),
  endedAt: DateTime.now(),
  clientCode: 4821,
  topicSlug: 'anxiety-stress',
  priceTiyn: 500000,
  plannedDurationMin: 30,
  paymentStatus: ConsultationPaymentStatus.captured,
);

Widget _wrap(SqApi api) => ProviderScope(
      overrides: [sqApiProvider.overrideWithValue(api)],
      child: MaterialApp(
        locale: const Locale('ru'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => showOutcomeSheet(context, consultationId: 'cons-1'),
            child: const Text('open'),
          ),
        ),
      ),
    );

void main() {
  setUpAll(() {
    registerFallbackValue(ConsultationOutcome.completed);
  });

  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
  });

  testWidgets('выбор исхода вызывает completeConsultation и закрывает шторку', (tester) async {
    when(() => api.completeConsultation('cons-1', ConsultationOutcome.completed))
        .thenAnswer((_) async => _consultation(ConsultationOutcome.completed));

    await tester.pumpWidget(_wrap(api));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('sq-outcome-COMPLETED')), findsOneWidget);

    await tester.tap(find.byKey(const Key('sq-outcome-COMPLETED')));
    await tester.pumpAndSettle();

    verify(() => api.completeConsultation('cons-1', ConsultationOutcome.completed)).called(1);
    expect(find.byKey(const Key('sq-outcome-COMPLETED')), findsNothing);
  });

  testWidgets('сбой сети показывает ошибку в шторке, не закрывая её', (tester) async {
    when(() => api.completeConsultation('cons-1', ConsultationOutcome.clientNoShow)).thenThrow(
      const ApiException(ApiErrorCode.consultationNotActive, 'Консультация уже завершена', 409),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-outcome-CLIENT_NO_SHOW')));
    await tester.pumpAndSettle();

    expect(find.text('Консультация уже завершена'), findsOneWidget);
    // Шторка всё ещё открыта — можно выбрать другой исход.
    expect(find.byKey(const Key('sq-outcome-COMPLETED')), findsOneWidget);
  });
}
